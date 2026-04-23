// ═══════════════════════════════════════════════════════════════════════════
// DAMS — Main JavaScript
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    console.log('DAMS Initialized');

    // ── Auto-hide flash messages ─────────────────────────────────────────
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateX(40px)';
            setTimeout(() => alert.remove(), 400);
        }, 5000);
    });

    // ── Mobile sidebar toggle ────────────────────────────────────────────
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // ── Confirm delete dialogs (SweetAlert2) ─────────────────────────────
    document.addEventListener('click', (e) => {
        const confirmEl = e.target.closest('[data-confirm]');
        if (!confirmEl) return;

        e.preventDefault();
        const message = confirmEl.dataset.confirm || 'Are you sure?';
        const title = confirmEl.dataset.title || 'Are you sure?';
        const isDelete = confirmEl.classList.contains('text-danger') || message.toLowerCase().includes('delete') || message.toLowerCase().includes('remove') || message.toLowerCase().includes('archive');

        Swal.fire({
            title: title,
            text: message,
            icon: isDelete ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonColor: isDelete ? '#ef4444' : 'var(--primary)',
            cancelButtonColor: '#6b7280',
            confirmButtonText: isDelete ? 'Yes, delete it!' : 'Yes, proceed',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            background: '#ffffff',
            borderRadius: '12px'
        }).then((result) => {
            if (result.isConfirmed) {
                // If it's a button inside a form, submit the form
                const form = confirmEl.closest('form');
                if (form) {
                    form.submit();
                } else if (confirmEl.tagName === 'A') {
                    window.location.href = confirmEl.href;
                }
            }
        });
    });

    // ── Active sidebar link highlighting ─────────────────────────────────
    const currentPath = window.location.pathname;
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            // Remove active from siblings
            link.closest('ul')?.querySelectorAll('a').forEach(l => {
                l.classList.remove('active', 'btn-primary');
                l.classList.add('nav-link');
            });
            link.classList.add('active');
        }
    });
});

// ── Utility: Show toast notification ─────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.querySelector('.flash-messages') || (() => {
        const div = document.createElement('div');
        div.className = 'flash-messages';
        document.body.appendChild(div);
        return div;
    })();

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);

    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateX(40px)';
        setTimeout(() => alert.remove(), 400);
    }, 4000);
}
