
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
                            Add this to the index.html header

  <link rel="manifest" href="/manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Onchain Survivor">
  <link rel="apple-touch-icon" href="Media/Classes/Onchain Survivor/MSURVIVOR.png">


                            Add this to the index.html body

   <script src="service-worker.js"></script>
  ---------------------------------------------------------------------------*/