document.addEventListener('DOMContentLoaded', () => {
	const statusEl = document.querySelector('#status');
	const fileInput = document.querySelector('#file-input');
	const form = document.querySelector('#upload-form');
	const grid = document.querySelector('#orders-grid');
	const emptyState = document.querySelector('#empty-state');

	const state = {
		orders: [],
		expandedId: null,
		editingId: null,
		drafts: {},
		isSaving: false,
	};

	const currencyFormatter = new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: 'USD',
	});

	let statusClearTimer = null;

	function setStatus(message, options = {}) {
		if (statusClearTimer !== null) {
			clearTimeout(statusClearTimer);
			statusClearTimer = null;
		}

		statusEl.textContent = message ?? '';

		if (options.autoClear) {
			const delay = options.autoClear === true ? 3000 : Number(options.autoClear) || 3000;
			statusClearTimer = setTimeout(() => {
				statusEl.textContent = '';
				statusClearTimer = null;
			}, delay);
		}
	}

	function clearStatus() {
		setStatus('');
	}

	function formatCurrency(value, fallback) {
		if (typeof value !== 'number' || Number.isNaN(value)) {
			return fallback;
		}
		return currencyFormatter.format(value);
	}

	function formatDate(value) {
		if (!value) {
			return '—';
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
	}

	function startEditing(order) {
		state.editingId = order._id;
		if (!state.drafts[order._id]) {
			state.drafts[order._id] = JSON.stringify(order, null, 2);
		}
		setStatus('Editing purchase order…', { autoClear: 3500 });
		renderOrders();
	}

	function cancelEditing(orderId) {
		delete state.drafts[orderId];
		state.editingId = null;
		state.isSaving = false;
		setStatus('Edit cancelled.', { autoClear: 2500 });
		renderOrders();
	}

	async function submitEdit(orderId, rawDraft) {
		let payload;

		try {
			payload = JSON.parse(rawDraft);
		} catch (error) {
			setStatus(`Invalid JSON: ${error instanceof Error ? error.message : 'Unable to parse.'}`);
			return;
		}

		state.isSaving = true;
		renderOrders();
		setStatus('Saving changes…');

		try {
			const response = await fetch(`/api/purchase-orders/${orderId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			const text = await response.text();
			let data = null;

			if (text) {
				try {
					data = JSON.parse(text);
				} catch (error) {
					console.error('Unable to parse server response', error);
				}
			}

			if (!response.ok) {
				const message = data && data.message ? data.message : 'Failed to save purchase order.';
				throw new Error(message);
			}

			if (data) {
				const index = state.orders.findIndex((order) => order._id === orderId);
				if (index >= 0) {
					state.orders[index] = data;
				} else {
					state.orders.unshift(data);
				}
			}

			delete state.drafts[orderId];
			state.editingId = null;
			state.expandedId = orderId;
			setStatus('Purchase order updated.', { autoClear: 3500 });
		} catch (error) {
			console.error(error);
			setStatus(error instanceof Error ? error.message : 'Failed to save purchase order.', { autoClear: 4000 });
		} finally {
			state.isSaving = false;
			renderOrders();
		}
	}

	function renderOrders() {
		const orders = state.orders;
		grid.innerHTML = '';

		if (!orders.length) {
			emptyState.hidden = false;
			return;
		}

		emptyState.hidden = true;

		for (const order of orders) {
			const isExpanded = state.expandedId === order._id;
			const isEditing = state.editingId === order._id;

			const card = document.createElement('article');
			card.className = 'card';
			if (isExpanded) {
				card.classList.add('expanded');
			}

			const summaryButton = document.createElement('button');
			summaryButton.type = 'button';
			summaryButton.className = 'card-summary';
			summaryButton.innerHTML = `
				<div>
					<h2>${order.vendor?.name ?? 'Unknown vendor'}</h2>
					<small>${order.vendor?.address ?? ''}</small>
				</div>
				<div>
					<span class="badge">Total ${formatCurrency(order.total, '—')}</span>
					<small>Issued ${order.issueDate ?? 'n/a'} · Received ${formatDate(order.createdAt)}</small>
				</div>
				<div>
					<strong>Purchaser:</strong>
					<div>${order.purchaser?.name ?? 'Unknown buyer'}</div>
					<small>${order.purchaser?.address ?? ''}</small>
				</div>
				<div>
					<strong>Items:</strong>
					<ul class="item-list">
						${(order.items ?? [])
							.map((item) => `
								<li>
									${item.quantity ?? '?'} × ${item.name ?? 'Unnamed'} @ ${formatCurrency(item.unitPrice, 'n/a')}
									${isExpanded ? `<span class="line-total">· Total ${formatCurrency(item.totalPrice, 'n/a')}</span>` : ''}
								</li>
							`)
							.join('')}
					</ul>
				</div>
			`;
			summaryButton.addEventListener('click', () => {
				if (isExpanded) {
					state.expandedId = null;
					state.editingId = null;
					clearStatus();
				} else {
					state.expandedId = order._id;
				}
				renderOrders();
			});

			card.appendChild(summaryButton);

			if (isExpanded) {
				const actions = document.createElement('div');
				actions.className = 'card-actions';

				const editButton = document.createElement('button');
				editButton.type = 'button';
				editButton.className = 'secondary';
				editButton.textContent = isEditing ? 'Editing…' : 'Edit';
				editButton.disabled = isEditing || state.isSaving;
				editButton.addEventListener('click', (event) => {
					event.stopPropagation();
					if (!isEditing)
						startEditing(order);
				});

				actions.appendChild(editButton);
				card.appendChild(actions);

				if (order.notes) {
					const notes = document.createElement('div');
					notes.className = 'notes';
					const notesLabel = document.createElement('strong');
					notesLabel.textContent = 'Notes';
					notes.appendChild(notesLabel);
					const notesBody = document.createElement('p');
					notesBody.textContent = order.notes;
					notes.appendChild(notesBody);
					card.appendChild(notes);
				}

				const editArea = document.createElement('div');
				editArea.className = 'edit-area';
				editArea.addEventListener('click', (event) => event.stopPropagation());

				const textarea = document.createElement('textarea');
				textarea.className = 'json-editor';
				textarea.value = state.drafts[order._id] ?? JSON.stringify(order, null, 2);
				textarea.spellcheck = false;
				textarea.disabled = !isEditing;
				textarea.readOnly = !isEditing;
				textarea.addEventListener('input', () => {
					if (!textarea.disabled)
						state.drafts[order._id] = textarea.value;
				});
				editArea.appendChild(textarea);

				if (isEditing) {
					const buttonRow = document.createElement('div');
					buttonRow.className = 'edit-buttons';

					const submitButton = document.createElement('button');
					submitButton.type = 'button';
					submitButton.textContent = state.isSaving ? 'Saving…' : 'Submit changes';
					submitButton.disabled = state.isSaving;
					submitButton.addEventListener('click', async (event) => {
						event.stopPropagation();
						await submitEdit(order._id, textarea.value);
					});

					const cancelButton = document.createElement('button');
					cancelButton.type = 'button';
					cancelButton.className = 'secondary';
					cancelButton.textContent = 'Cancel';
					cancelButton.disabled = state.isSaving;
					cancelButton.addEventListener('click', (event) => {
						event.stopPropagation();
						cancelEditing(order._id);
					});

					buttonRow.append(submitButton, cancelButton);
					editArea.appendChild(buttonRow);
				}

				card.appendChild(editArea);
			}

			grid.appendChild(card);
		}
	}

	async function fetchOrders(silent = false) {
		if (!silent) {
			setStatus('Refreshing list…');
		}
		try {
			const response = await fetch('/api/purchase-orders');
			if (!response.ok) {
				throw new Error('Failed to fetch purchase orders');
			}
			const data = await response.json();
			state.orders = Array.isArray(data) ? data : [];
			renderOrders();
			if (!silent) {
				clearStatus();
			}
		} catch (error) {
			console.error(error);
			setStatus('Could not refresh purchase orders.', { autoClear: 4000 });
		}
	}

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!fileInput.files?.length) {
			setStatus('Choose a PDF to upload.', { autoClear: 3000 });
			return;
		}

		const formData = new FormData();
		formData.append('file', fileInput.files[0]);

		setStatus('Uploading…');
		try {
			const response = await fetch('/api/purchase-orders/upload', {
				method: 'POST',
				body: formData,
			});

			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(payload?.message ?? 'Upload failed');
			}

			fileInput.value = '';
			setStatus('Upload complete!', { autoClear: 3500 });
			await fetchOrders(true);
			renderOrders();
		} catch (error) {
			console.error(error);
			setStatus(error instanceof Error ? error.message : 'Upload failed.', { autoClear: 4000 });
		}
	});

	fetchOrders();
});
