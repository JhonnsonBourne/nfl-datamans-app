import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

export default function Navigation() {
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const navRef = useRef(null);
    const logoRef = useRef(null);
    const navItemsRef = useRef(null);

    const navItems = [
        { path: '/', label: 'Home', icon: '🏈', shortLabel: 'Home' },
        { path: '/player-stats', label: 'Player Stats', icon: '📊', shortLabel: 'Stats' },
        { path: '/comparison', label: 'Compare', icon: '⚔️', shortLabel: 'Compare' },
        { path: '/leaderboards', label: 'Leaderboards', icon: '🏆', shortLabel: 'Leaders' },
        { path: '/teams', label: 'Teams', icon: '🛡️', shortLabel: 'Teams' },
    ];

    useEffect(() => {
        if (showDebug && navRef.current && logoRef.current && navItemsRef.current) {
            const nav = navRef.current;
            const logo = logoRef.current;
            const navItems = navItemsRef.current;
            
            console.log('=== Navigation Debug Info ===');
            console.log('Container width:', nav.offsetWidth);
            console.log('Logo width:', logo.offsetWidth);
            console.log('Nav items container width:', navItems.offsetWidth);
            console.log('Available space:', nav.offsetWidth - logo.offsetWidth - navItems.offsetWidth);
            console.log('Window width:', window.innerWidth);
            console.log('Breakpoint:', window.innerWidth >= 1280 ? 'xl' : window.innerWidth >= 1024 ? 'lg' : window.innerWidth >= 768 ? 'md' : 'sm');
            
            // Log each button
            const buttons = navItems.querySelectorAll('a');
            buttons.forEach((btn, idx) => {
                console.log(`Button ${idx + 1} (${navItems[idx]?.label}):`, {
                    width: btn.offsetWidth,
                    computedWidth: window.getComputedStyle(btn).width,
                    padding: window.getComputedStyle(btn).padding,
                    margin: window.getComputedStyle(btn).margin,
                    flexShrink: window.getComputedStyle(btn).flexShrink,
                    minWidth: window.getComputedStyle(btn).minWidth
                });
            });
        }
    }, [showDebug, location.pathname]);

    return (
        <nav className="bg-primary-900 text-white shadow-lg sticky top-0 z-50" ref={navRef}>
            <div className="container mx-auto px-2 sm:px-4">
                <div className="flex items-center h-16" style={showDebug ? { border: '2px solid red' } : {}}>
                    {/* Logo - Fixed width to prevent shrinking */}
                    <Link 
                        to="/" 
                        ref={logoRef}
                        className="flex items-center space-x-1 hover:opacity-90 transition-opacity flex-shrink-0 mr-4"
                        style={showDebug ? { border: '2px solid yellow', backgroundColor: 'rgba(255,255,0,0.2)' } : {}}
                    >
                        <span className="text-lg sm:text-xl flex-shrink-0">🏈</span>
                        <span className="text-base sm:text-lg font-heading font-semibold tracking-tight whitespace-nowrap hidden xl:inline">NFL Data Hub</span>
                        <span className="text-base sm:text-lg font-heading font-semibold tracking-tight whitespace-nowrap xl:hidden hidden lg:inline">NFL Hub</span>
                        <span className="text-base sm:text-lg font-heading font-semibold tracking-tight whitespace-nowrap lg:hidden">NFL</span>
                    </Link>

                    {/* Desktop Navigation - Single responsive nav */}
                    <nav 
                        ref={navItemsRef}
                        className="hidden md:flex items-center gap-2 flex-shrink-0 ml-auto" 
                        aria-label="Main navigation"
                        style={showDebug ? { border: '2px solid blue', backgroundColor: 'rgba(0,0,255,0.2)' } : {}}
                    >
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`px-3 py-1.5 rounded-md transition-all duration-200 text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                                    location.pathname === item.path
                                        ? 'bg-primary-700 text-white font-semibold shadow-sm'
                                        : 'hover:bg-primary-800 text-white'
                                }`}
                                title={item.label}
                                style={{
                                    minWidth: 'max-content',
                                    ...(showDebug ? { border: '1px solid green', backgroundColor: 'rgba(0,255,0,0.1)' } : {})
                                }}
                            >
                                <span className="mr-1.5">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    {/* Debug Toggle */}
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="md:hidden fixed bottom-4 right-4 bg-red-500 text-white px-2 py-1 rounded text-xs z-50"
                    >
                        Debug Nav
                    </button>
                    {showDebug && (
                        <button
                            onClick={() => setShowDebug(false)}
                            className="hidden md:block absolute top-16 right-4 bg-red-500 text-white px-2 py-1 rounded text-xs z-50"
                        >
                            Hide Debug
                        </button>
                    )}

                    {/* Mobile menu button */}
                    <div className="md:hidden flex-shrink-0 ml-auto">
                        <button 
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-md hover:bg-primary-800 transition-colors"
                            aria-label="Toggle menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {mobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-primary-800 py-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`block px-4 py-2 rounded-md transition-all duration-200 font-medium ${
                                    location.pathname === item.path
                                        ? 'bg-primary-700 text-white font-semibold'
                                        : 'hover:bg-primary-800 text-white'
                                }`}
                            >
                                <span className="mr-2">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Debug Panel */}
                {showDebug && (
                    <div className="absolute top-16 left-0 right-0 bg-black bg-opacity-90 text-white p-4 text-xs z-50 max-h-96 overflow-y-auto">
                        <div className="font-bold mb-2">Navigation Debug Info</div>
                        {navRef.current && logoRef.current && navItemsRef.current && (
                            <>
                                <div>Container Width: {navRef.current.offsetWidth}px</div>
                                <div>Logo Width: {logoRef.current.offsetWidth}px</div>
                                <div>Nav Items Width: {navItemsRef.current.offsetWidth}px</div>
                                <div>Available Space: {navRef.current.offsetWidth - logoRef.current.offsetWidth - navItemsRef.current.offsetWidth}px</div>
                                <div>Window Width: {window.innerWidth}px</div>
                                <div>Breakpoint: {window.innerWidth >= 1280 ? 'xl' : window.innerWidth >= 1024 ? 'lg' : window.innerWidth >= 768 ? 'md' : 'sm'}</div>
                                <div className="mt-2">
                                    <div className="font-bold">Button Details:</div>
                                    {Array.from(navItemsRef.current.querySelectorAll('a')).map((btn, idx) => {
                                        const styles = window.getComputedStyle(btn);
                                        return (
                                            <div key={idx} className="ml-2 mt-1">
                                                {navItems[idx]?.label}: width={btn.offsetWidth}px, 
                                                padding={styles.padding}, 
                                                flexShrink={styles.flexShrink},
                                                minWidth={styles.minWidth}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
