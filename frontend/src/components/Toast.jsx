/**
 * Toast Notification Component
 * Provides user feedback for actions
 */

import { useState, useEffect } from 'react';

export function Toast({ message, type = 'info', duration = 3000, onClose }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300); // Wait for fade out
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const typeStyles = {
        success: 'bg-success-500 text-white',
        error: 'bg-error-500 text-white',
        warning: 'bg-warning-500 text-white',
        info: 'bg-primary-500 text-white'
    };

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    if (!isVisible) return null;

    return (
        <div
            className={`fixed bottom-4 right-4 ${typeStyles[type]} px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 transition-all duration-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
        >
            <span className="text-lg">{icons[type]}</span>
            <span className="font-medium">{message}</span>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(() => onClose?.(), 300);
                }}
                className="ml-2 hover:opacity-80"
            >
                ×
            </button>
        </div>
    );
}

export function useToast() {
    const [toasts, setToasts] = useState([]);

    const showToast = (message, type = 'info', duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, duration }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    const ToastContainer = () => (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );

    return { showToast, ToastContainer };
}






