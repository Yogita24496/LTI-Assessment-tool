// Add this to your main app.js to verify all routes are registered
const listRoutes = (app) => {
  console.log('\n📋 REGISTERED ROUTES:');
  console.log('===================');
  
  app._router.stack.forEach((middleware, index) => {
    if (middleware.route) {
      // Direct route
      console.log(`${index + 1}. ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      // Router middleware
      const routerPath = middleware.regexp.source
        .replace('\\', '')
        .replace('(?=\\/|$)', '')
        .replace('^', '')
        .replace('$', '');
      
      console.log(`${index + 1}. Router: ${routerPath || '/'}`);
      
      if (middleware.handle && middleware.handle.stack) {
        middleware.handle.stack.forEach((route, routeIndex) => {
          if (route.route) {
            const methods = Object.keys(route.route.methods).join(', ').toUpperCase();
            console.log(`   ${routeIndex + 1}. ${methods} ${routerPath}${route.route.path}`);
          }
        });
      }
    }
  });
  console.log('===================\n');
};

// Check if a specific route exists
const checkRoute = (app, method, path) => {
  let found = false;
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      if (middleware.route.path === path && middleware.route.methods[method.toLowerCase()]) {
        found = true;
      }
    } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
      middleware.handle.stack.forEach((route) => {
        if (route.route) {
          const routerPath = middleware.regexp.source
            .replace('\\', '')
            .replace('(?=\\/|$)', '')
            .replace('^', '')
            .replace('$', '');
          
          const fullPath = routerPath + route.route.path;
          if (fullPath === path && route.route.methods[method.toLowerCase()]) {
            found = true;
          }
        }
      });
    }
  });
  
  return found;
};

module.exports = { listRoutes, checkRoute };