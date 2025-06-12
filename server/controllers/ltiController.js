// controllers/ltiController.js
const { validateLtiJwt } = require('../services/lti');
const LTIDeployment = require('../models/LTIDeployment');
const Assessment = require('../models/Assessment');
const mongoose = require('mongoose');
// Handle LTI 1.3 login via POST request
exports.handleLtiLoginPost = async (req, res, next) => {
  try {
    // Log the request details
    console.log('LTI Login POST received:');
    console.log('- Content Type:', req.get('content-type'));
    console.log('- Body:', req.body || 'No body');
    console.log('- Query:', req.query);
    
    // Parse request body if it's a Buffer
    let parsedBody = {};
    if (Buffer.isBuffer(req.body)) {
      try {
        const bodyStr = req.body.toString();
        console.log('Raw body as string:', bodyStr);
        
        // Try to parse based on content type
        const contentType = req.get('content-type') || '';
        if (contentType.includes('application/json')) {
          parsedBody = JSON.parse(bodyStr);
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(bodyStr);
          for (const [key, value] of params.entries()) {
            parsedBody[key] = value;
          }
        }
        
        console.log('Manually parsed body:', parsedBody);
      } catch (err) {
        console.error('Failed to parse body:', err);
      }
    } else if (typeof req.body === 'object') {
      parsedBody = req.body;
    }
    
    // Extract the OIDC parameters - check body, parsed body, and query
    const iss = parsedBody.iss || req.query.iss;
    const login_hint = parsedBody.login_hint || req.query.login_hint;
    const target_link_uri = parsedBody.target_link_uri || req.query.target_link_uri;
    const lti_message_hint = parsedBody.lti_message_hint || req.query.lti_message_hint || '';
    
    // Try to extract params from a URL-encoded form submission
    const urlParams = new URL(`http://dummy.com${req.url}`).searchParams;
    const issFromUrl = urlParams.get('iss');
    const loginHintFromUrl = urlParams.get('login_hint');
    const targetLinkUriFromUrl = urlParams.get('target_link_uri');
    
    // Use URL params if main params are missing
    const finalIss = iss || issFromUrl;
    const finalLoginHint = login_hint || loginHintFromUrl;
    const finalTargetLinkUri = target_link_uri || targetLinkUriFromUrl;
    
    console.log('Extracted parameters:', {
      iss: finalIss,
      login_hint: finalLoginHint,
      target_link_uri: finalTargetLinkUri,
      lti_message_hint
    });
    
    if (!finalIss || !finalLoginHint || !finalTargetLinkUri) {
      console.error('Missing OIDC parameters in POST request:', {
        iss: finalIss,
        login_hint: finalLoginHint,
        target_link_uri: finalTargetLinkUri
      });
      
      // Instead of returning error, try to extract from URL if this is a redirect
      // This is a fallback in case parameters are in the URL path
      const urlPath = req.url;
      if (urlPath.includes('iss=') && urlPath.includes('login_hint=')) {
        console.log('Attempting to extract parameters from URL path');
        
        // Extract params from URL manually
        const extractParam = (param) => {
          const regex = new RegExp(`${param}=([^&]+)`);
          const match = urlPath.match(regex);
          return match ? decodeURIComponent(match[1]) : null;
        };
        
        const pathIss = extractParam('iss');
        const pathLoginHint = extractParam('login_hint');
        const pathTargetLinkUri = extractParam('target_link_uri');
        
        console.log('URL path extracted:', {
          iss: pathIss,
          login_hint: pathLoginHint,
          target_link_uri: pathTargetLinkUri
        });
        
        if (pathIss && pathLoginHint && pathTargetLinkUri) {
          // Continue with these parameters
          return await processLogin(
            pathIss, 
            pathLoginHint, 
            pathTargetLinkUri, 
            req.query.lti_message_hint || '',
            req,
            res
          );
        }
      }
      
      // If all attempts fail, return an error with diagnostic info
      return res.status(400).json({
        error: 'Missing required OIDC parameters',
        received: {
          url: req.url,
          body: typeof req.body === 'object' ? req.body : 'Not an object',
          parsedBody,
          query: req.query,
          contentType: req.get('content-type'),
          extractedParams: {
            iss: finalIss,
            login_hint: finalLoginHint,
            target_link_uri: finalTargetLinkUri
          }
        }
      });
    }
    
    // Process the login with extracted parameters
    return await processLogin(
      finalIss,
      finalLoginHint,
      finalTargetLinkUri,
      lti_message_hint,
      req,
      res
    );
    
  } catch (error) {
    console.error('Error in handleLtiLoginPost:', error);
    next(error);
  }
};

// Helper function to process login (used by both GET and POST handlers)
async function processLogin(iss, login_hint, target_link_uri, lti_message_hint, req, res) {
  try {
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    const deployments = await LTIDeployment.find({});
console.log('Registered issuers:', deployments.map(d => d.issuer));
    // Look up the registered platform for this issuer (iss)
    const platform = await LTIDeployment.findOne({ issuer: iss });
    console.log("platform",LTIDeployment);
    if (!platform) {
      console.error('Unknown platform issuer:', iss);
      return res.status(404).json({ 
        error: 'Unknown platform issuer',
        issuer: iss
      });
    }
    
    // Generate OIDC authentication request
    const state = generateRandomState();
    const nonce = generateRandomNonce();
    
    // Store the state and nonce for verification later
    req.session = req.session || {};
    req.session.ltiState = {
      state,
      nonce,
      target_link_uri
    };
    
    // Redirect to the platform's auth URL
    const authUrl = new URL(platform.authenticationEndpoint);
    authUrl.searchParams.append('client_id', platform.clientId);
    authUrl.searchParams.append('login_hint', login_hint);
    authUrl.searchParams.append('lti_message_hint', lti_message_hint || '');
    authUrl.searchParams.append('nonce', nonce);
    authUrl.searchParams.append('prompt', 'none');
    authUrl.searchParams.append('redirect_uri', `${process.env.BASE_URL}/api/lti/launch`);
    authUrl.searchParams.append('response_mode', 'form_post');
    authUrl.searchParams.append('response_type', 'id_token');
    authUrl.searchParams.append('scope', 'openid');
    authUrl.searchParams.append('state', state);
    
    console.log('Redirecting to platform authentication URL:', authUrl.toString());
    return res.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error in processLogin:', error);
    throw error;
  }
}

// Handle LTI 1.3 login via GET request (initial OIDC redirect)
exports.handleLtiLogin = async (req, res, next) => {
  try {
    // Log only the relevant parts of the request
    console.log('LTI Login GET request query parameters:', req.query);
    
    // Extract the OIDC parameters
    const { iss, login_hint, target_link_uri } = req.query;
    const lti_message_hint = req.query.lti_message_hint || '';
 
    if (!iss || !login_hint || !target_link_uri) {
      console.error('Missing OIDC parameters:', { iss, login_hint, target_link_uri });
      return res.status(400).json({ 
        error: 'Missing required OIDC parameters',
        received: { iss, login_hint, target_link_uri } 
      });
    }
   
    // Process the login with extracted parameters
    return await processLogin(
      iss,
      login_hint,
      target_link_uri,
      lti_message_hint,
      req,
      res
    );
   
  } catch (error) {
    console.error('Error in handleLtiLogin:', error);
    next(error);
  }
};

// Handle LTI 1.3 launch
exports.handleLtiLaunch = async (req, res, next) => {
  try {
    // console.log('LTI Launch request body (partial):', { 
    //   id_token: req.body.id_token ? 'present (not shown for security)' : 'missing',
    //   state: req.body.state
    // });

    const { id_token, state } = req.body;
   
    if (!id_token) {
      return res.status(400).json({ error: 'Missing id_token' });
    }
   
    // Verify the state parameter matches what we set during login
    // This is simplified - you should use sessions or database
    if (!req.session || !req.session.ltiState || req.session.ltiState.state !== state) {
      return res.status(401).json({ error: 'Invalid state parameter' });
    }
    
    // Validate the LTI JWT
    const validation = await validateLtiJwt(id_token, req.session.ltiState.nonce);
   
    if (!validation.isValid) {
      return res.status(401).json({ error: validation.error });
    }
   
    const { payload } = validation;
   
    // Extract key LTI claims
    const userId = payload['sub'];
    const courseId = payload['https://purl.imsglobal.org/spec/lti/claim/context']?.id;
    const resourceLinkId = payload['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id;
   
    // Extract AGS endpoint if available
    let lineItemUrl = null;
    if (payload['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']) {
      const agsEndpoint = payload['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];
     console.log("agsEndpoint.lineitem",agsEndpoint.lineitem);
      // Check for lineitem
      if (agsEndpoint.lineitem) {
        lineItemUrl = agsEndpoint.lineitem;
      } else if (agsEndpoint.lineitems) {
        // Need to query lineitems to find the correct one - simplified here
        lineItemUrl = agsEndpoint.lineitems;
      }
    }
   
    // Store launch data in session or return to client
    const launchData = {
      userId,
      courseId,
      resourceLinkId,
      lineItemUrl,
      roles: payload['https://purl.imsglobal.org/spec/lti/claim/roles'],
      name: payload['name'],
      email: payload['email']
    };
   
    // Return the launch data
    // res.json({
    //   success: true,
    //   launchData
    // });
    res.redirect(`http://localhost:3000/assessment?data=${encodeURIComponent(JSON.stringify(launchData))}`);
   
  } catch (error) {
    console.error('Error in handleLtiLaunch:', error);
    next(error);
  }
};

// Helper functions for OIDC flow
function generateRandomState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateRandomNonce() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}