/**
 * Why Did You Render - React re-render debugging
 * 
 * This helps identify unnecessary re-renders in React components
 * 
 * Usage:
 * 1. Add `whyDidYouRender = true` to components you want to track
 * 2. Check console for re-render reasons
 */

let wdyr = null;

if (process.env.NODE_ENV === 'development') {
    try {
        // Try to import why-did-you-render if available
        wdyr = require('@welldone-software/why-did-you-render');
        wdyr(React, {
            trackAllPureComponents: false,
            trackHooks: true,
            trackExtraHooks: [
                [require('react-router-dom'), 'useLocation', 'useParams'],
            ],
            logOnDifferentValues: true,
            collapseGroups: true,
        });
        console.log('✅ Why Did You Render initialized');
    } catch (e) {
        // why-did-you-render not installed
        console.log('ℹ️ Why Did You Render not available (install: npm install @welldone-software/why-did-you-render)');
    }
}

export default wdyr;

