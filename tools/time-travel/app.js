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
                // Apply only to bg element
                bgElement.style.backgroundImage = `url("${imageUrl}")`;
                bgElement.style.backgroundSize = 'cover';
                bgElement.style.backgroundPosition = 'center center';
                bgElement.style.backgroundRepeat = 'no-repeat';
                bgElement.classList.remove('hidden');
                
                console.log('Background image applied to #bg');
            };
            reader.readAsDataURL(file);
        });
    }
    
    console.log('Time travel tool initialized');
})();
