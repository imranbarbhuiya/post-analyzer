import { useEffect, useState } from 'react';

import { storage } from '~storage';

function IndexPopup() {
	const [systemPrompt, setSystemPrompt] = useState('');
	const [apiKey, setApiKey] = useState('');
	const [error, setError] = useState('');
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		const fetchSettings = async () => {
			const savedPrompt = (await storage.get('ps.systemPrompt')) ?? '';
			const savedKey = (await storage.get('ps.apiKey')) ?? '';
			setSystemPrompt(savedPrompt);
			setApiKey(savedKey);
		};
		void fetchSettings();
	}, []);

	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (!systemPrompt.trim()) {
			setError('System prompt is required');
			return;
		}
		if (!apiKey.trim()) {
			setError('OpenAI API key is required');
			return;
		}
		void storage.set('ps.systemPrompt', systemPrompt);
		void storage.set('ps.apiKey', apiKey);
		setSubmitted(true);
	};

	return (
		<div
			style={{
				padding: 16,
				minWidth: 320,
				background: '#fff',
				color: '#111',
				fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
			}}
		>
			<h2
				style={{
					margin: 0,
					fontSize: 18,
					fontWeight: 600,
					letterSpacing: -0.2,
				}}
			>
				Setup
			</h2>
			<p
				style={{
					margin: '6px 0 16px',
					fontSize: 12,
					color: '#555',
				}}
			>
				Configure your system prompt and OpenAI key.
			</p>
			<form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
				<label
					style={{
						display: 'grid',
						gap: 6,
						fontSize: 12,
						color: '#111',
					}}
				>
					<span style={{ fontWeight: 600 }}>System Prompt</span>
					<textarea
						onChange={(e) => {
							setSystemPrompt(e.target.value);
							setSubmitted(false);
						}}
						placeholder="You are a helpful assistant..."
						rows={5}
						style={{
							resize: 'vertical',
							padding: 10,
							borderRadius: 8,
							border: '1px solid #111',
							background: '#fff',
							color: '#111',
							outline: 'none',
							boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
						}}
						value={systemPrompt}
					/>
				</label>
				<label
					style={{
						display: 'grid',
						gap: 6,
						fontSize: 12,
						color: '#111',
					}}
				>
					<span style={{ fontWeight: 600 }}>OpenAI API Key</span>
					<input
						onChange={(e) => {
							setApiKey(e.target.value);
							setSubmitted(false);
						}}
						placeholder="sk-..."
						style={{
							height: 36,
							padding: '0 10px',
							borderRadius: 8,
							border: '1px solid #111',
							background: '#fff',
							color: '#111',
							outline: 'none',
							boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
						}}
						type="password"
						value={apiKey}
					/>
				</label>
				{error ? <div style={{ fontSize: 12, color: '#b00000' }}>{error}</div> : null}
				{submitted ? (
					<div style={{ fontSize: 12, color: '#0b6b0b' }}>Settings saved successfully!</div>
				) : (
					<button
						style={{
							height: 36,
							borderRadius: 999,
							background: '#111',
							color: '#fff',
							border: '1px solid #111',
							fontWeight: 600,
							cursor: 'pointer',
						}}
						type="submit"
					>
						Save
					</button>
				)}
			</form>
		</div>
	);
}

export default IndexPopup;
