// JavaScript for Time Travel Tool - Full-screen background image handling
(function() {
    const screenshotInput = document.getElementById('screenshotInput');
    const bgElement = document.getElementById('bg');
    
    if (screenshotInput && bgElement) {
        screenshotInput.addEventListener('change', function(e) {
            const file = e.target.files?.[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result;
                // Apply to both bg element and body for full coverage
                bgElement.style.backgroundImage = `url("${imageUrl}")`;
                bgElement.style.backgroundSize = 'cover';
                bgElement.style.backgroundPosition = 'center center';
                bgElement.style.backgroundRepeat = 'no-repeat';
                bgElement.classList.remove('hidden');
                
                // Also apply to body to ensure full-screen background
                document.body.style.backgroundImage = `url("${imageUrl}")`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center center';
                document.body.style.backgroundRepeat = 'no-repeat';
                
                console.log('Background image applied to #bg and body');
            };
            reader.readAsDataURL(file);
        });
    }
    
    console.log('Time travel tool initialized');
})();
