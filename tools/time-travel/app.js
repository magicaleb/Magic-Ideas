// JavaScript for Time Travel Tool - Full-screen background image handling
(function() {
    const screenshotInput = document.getElementById('screenshotInput');
    const bgElement = document.getElementById('bg');
    
    if (screenshotInput) {
        screenshotInput.addEventListener('change', function(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result;
                // Apply background to body element directly like simple-pwa.html
                document.body.style.backgroundImage = `url(${imageUrl})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center center';
                document.body.style.backgroundRepeat = 'no-repeat';
                
                // Also apply to bg element if it exists
                if (bgElement) {
                    bgElement.style.backgroundImage = `url(${imageUrl})`;
                    bgElement.classList.remove('hidden');
                }
                
                console.log('Background image applied');
            };
            reader.readAsDataURL(file);
        });
    }
    
    console.log('Time travel tool initialized');
})();
