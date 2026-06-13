/**
 * Script inline à insérer dans <head> AVANT tout autre script.
 * Évite le flash of unstyled content (FOUC) lors du chargement initial.
 * Positionne la classe 'dark' sur <html> selon la préférence stockée.
 */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('acra-theme')||'system';var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`
