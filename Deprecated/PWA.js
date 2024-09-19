
/*---------------------------------------------------------------------------
                            Service Worker for PWA
---------------------------------------------------------------------------*/

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);
      }, function(error) {
        console.log('Service Worker registration failed:', error);
      });
    });
  }  

/*---------------------------------------------------------------------------
                            Add this to the index.html body

   <script src="service-worker.js"></script>
  ---------------------------------------------------------------------------*/