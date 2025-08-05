import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import type { PlasmoCSConfig } from 'plasmo';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';

import { storage } from '~storage';

export const config: PlasmoCSConfig = {
	matches: ['https://x.com/*', 'https://www.x.com/*', 'https://twitter.com/*', 'https://www.twitter.com/*'],
	run_at: 'document_idle',
	all_frames: false,
};

const LoadingSpinner = () => (
	<div style={styles.spinner} aria-hidden>
		<div style={styles.spinnerInner}></div>
	</div>
);

const Modal = ({
	open,
	onClose,
	onSendAnyway,
	loading,
	reason,
}: {
	open: boolean;
	onClose: () => void;
	onSendAnyway: () => void;
	loading?: boolean;
	reason?: string;
}) => {
	const title = loading ? 'Checking your post…' : 'Review before posting';
	const description = loading
		? 'Analyzing your post with AI…'
		: 'This post might not land well. Consider revising for clarity or tone before sending.';

	if (!open) return null;
	return (
		<div
			style={styles.backdrop}
			onClick={loading ? undefined : onClose}
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<div style={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div style={styles.header}>{title}</div>
				<div style={styles.body}>
					{loading ? (
						<div style={styles.loadingContent}>
							<LoadingSpinner />
							<div>{description}</div>
						</div>
					) : (
						description
					)}
					{!loading && reason && <div style={styles.errorText}>⚠︎ {reason}</div>}
				</div>
				{!loading && (
					<div style={styles.footer}>
						<button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onClose} aria-label="Close dialog">
							Close
						</button>
						<button style={styles.button} onClick={onSendAnyway} aria-label="Send anyway">
							Send anyway
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

const resultSchema = z.object({
	isSendable: z.boolean(),
	score: z.number().meta({
		description: 'A score from 0 to 10, where 0 means sendable and 10 means completely blocked',
	}),
	reason: z.string().optional(),
	rephrasedText: z.string().optional(),
});

const App = () => {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [reason, setReason] = useState<string | null>(null);
	const pendingBypass = useRef<(() => void) | null>(null);

	const openaiFactory = useCallback(async () => {
		const apiKey = await storage.get('ps.apiKey');
		if (!apiKey) throw new Error('API key is not set');
		return createOpenAI({ apiKey });
	}, []);

	const evaluateSendability = useCallback(
		async (text: string) => {
			const sys = await storage.get('ps.systemPrompt');
			if (!sys) return { isSendable: true };
			try {
				const { object } = await generateObject({
					model: (await openaiFactory())('gpt-4o-mini'),
					system: sys,
					schema: resultSchema,
					prompt: `Evaluate if this message should be blocked. Respond with isSendable=false to block, true to allow. Draft:\n\n${text}`,
				});

				return object as z.infer<typeof resultSchema>;
			} catch (e) {
				console.error('Error evaluating sendability:', e);
				return { isSendable: false, reason: 'Error during evaluation' };
			}
		},
		[openaiFactory],
	);

	useEffect(() => {
		let isDisposed = false;

		const tryIntercept = async (submitAction: () => void) => {
			if (isDisposed) return;
			const composer = document.querySelector('[data-testid^="tweetTextarea_"]') as HTMLTextAreaElement | null;
			const text = composer?.textContent || composer?.value || '';
			setOpen(true);
			setLoading(true);
			try {
				const { isSendable, reason } = await evaluateSendability(text);
				if (isDisposed) return;
				setLoading(false);
				setReason(reason || null);

				if (!isSendable) {
					pendingBypass.current = submitAction;
				} else {
					setOpen(false);
					submitAction();
				}
			} catch (error) {
				if (isDisposed) return;
				setLoading(false);
				setOpen(false);
				console.error('Error during AI evaluation:', error);
				submitAction();
			}
		};

		const clickHandler = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target) return;
			const btn = target.closest(
				'[data-testid="tweetButtonInline"], [data-testid="tweetButton"]',
			) as HTMLElement | null;
			if (!btn) return;
			if (e.isTrusted === false) return;
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation?.();
			tryIntercept(() => {
				const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
				btn.dispatchEvent(ev);
			});
		};

		document.addEventListener('click', clickHandler, true);

		const keyHandler = (e: KeyboardEvent) => {
			const active = document.activeElement as HTMLElement | null;
			const isComposer = active?.getAttribute?.('data-testid')?.includes('tweetTextarea_');
			const isSubmitCombo = e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey);
			if (isComposer && isSubmitCombo) {
				e.preventDefault();
				e.stopPropagation();
				tryIntercept(() => {
					const btn = document.querySelector(
						'[data-testid="tweetButtonInline"], [data-testid="tweetButton"]',
					) as HTMLElement | null;
					if (btn) {
						const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
						btn.dispatchEvent(ev);
					}
				});
			}
		};

		document.addEventListener('keydown', keyHandler, true);

		const mo = new MutationObserver(() => {
			document
				.querySelectorAll<HTMLElement>('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]')
				.forEach((el) => {
					el.removeAttribute('aria-disabled');
					el.style.cursor = 'pointer';
				});
		});
		mo.observe(document.documentElement, { childList: true, subtree: true });

		return () => {
			isDisposed = true;
			document.removeEventListener('click', clickHandler, true);
			document.removeEventListener('keydown', keyHandler, true);
			mo.disconnect();
		};
	}, [evaluateSendability]);

	const handleClose = useCallback(() => {
		setOpen(false);
		setLoading(false);
	}, []);

	const handleSendAnyway = useCallback(() => {
		const fn = pendingBypass.current;
		pendingBypass.current = null;
		setOpen(false);
		setLoading(false);
		fn?.();
	}, []);

	return <Modal open={open} loading={loading} onClose={handleClose} onSendAnyway={handleSendAnyway} reason={reason} />;
};

const containerId = 'post-analyzer-x-modal-root';
let root: ReturnType<typeof createRoot> | null = null;

function ensureContainer() {
	if (document.getElementById(containerId)) return;
	if (!document.getElementById('post-analyzer-spinner-styles')) {
		const style = document.createElement('style');
		style.id = 'post-analyzer-spinner-styles';
		style.textContent = `
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
		document.head.appendChild(style);
	}
	const host = document.createElement('div');
	host.id = containerId;
	const shadow = host.attachShadow({ mode: 'open' });
	const mount = document.createElement('div');
	const shadowStyle = document.createElement('style');
	shadowStyle.textContent = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `;
	shadow.appendChild(shadowStyle);
	shadow.appendChild(mount);
	document.documentElement.appendChild(host);
	root = createRoot(mount);
	root.render(<App />);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', ensureContainer, { once: true });
} else {
	ensureContainer();
}

const styles: Record<string, React.CSSProperties> = {
	backdrop: {
		position: 'fixed',
		inset: 0,
		background: 'rgba(0,0,0,0.5)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 2147483647,
	},
	modal: {
		width: 360,
		maxWidth: '90vw',
		borderRadius: 12,
		background: '#0f1419',
		color: '#e7e9ea',
		boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
		border: '1px solid rgba(255,255,255,0.1)',
		overflow: 'hidden',
		fontFamily:
			'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
	},
	header: { padding: '12px 16px', fontSize: 18, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' },
	body: { padding: 16, fontSize: 14 },
	footer: { padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 },
	button: {
		appearance: 'none',
		border: 0,
		background: '#1d9bf0',
		color: 'white',
		padding: '8px 12px',
		borderRadius: 20,
		fontWeight: 600,
		cursor: 'pointer',
	},
	secondaryButton: { background: 'transparent', color: '#e7e9ea', border: '1px solid rgba(255,255,255,0.2)' },
	loadingContent: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 },
	spinner: { width: 20, height: 20, position: 'relative' },
	spinnerInner: {
		width: '100%',
		height: '100%',
		border: '2px solid rgba(231, 233, 234, 0.3)',
		borderTop: '2px solid #1d9bf0',
		borderRadius: '50%',
		animation: 'spin 1s linear infinite',
	},
	errorText: {
		marginTop: 12,
		color: '#f97066',
		fontSize: 13,
		lineHeight: 1.4,
		wordBreak: 'break-word',
		whiteSpace: 'pre-wrap',
	},
};
