// services/lti.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const LTIDeployment = require('../models/LTIDeployment');

/**
 * Validates an LTI 1.3 JWT token
 * @param {string} idToken - The JWT token from the LTI launch
 * @param {string} expectedNonce - The nonce that was generated during login
 * @returns {Object} Validation result with isValid flag and payload or error
 */
exports.validateLtiJwt = async (idToken, expectedNonce) => {
  try {
    // 1. Decode the token without verification to get the issuer and kid
    const decoded = jwt.decode(idToken, { complete: true });
    
    if (!decoded) {
      return { isValid: false, error: 'Invalid JWT format' };
    }
    
    const { header, payload } = decoded;
    const issuer = payload.iss;
    const kid = header.kid;
    
    // 2. Find the platform configuration for this issuer
    const platform = await LTIDeployment.findOne({ issuer });
    
    if (!platform) {
      return { isValid: false, error: 'Unknown platform issuer' };
    }
    
    // 3. Fetch the JWKS from the platform
    const client = jwksClient({
      jwksUri: platform.jwksEndpoint
    });
    
    // 4. Get the signing key
    const getSigningKey = (kid) => {
      return new Promise((resolve, reject) => {
        client.getSigningKey(kid, (err, key) => {
          if (err) return reject(err);
          const signingKey = key.publicKey || key.rsaPublicKey;
          resolve(signingKey);
        });
      });
    };
    
    const signingKey = await getSigningKey(kid);
    
    // 5. Verify the token
    const verifiedToken = jwt.verify(idToken, signingKey, {
      algorithms: ['RS256'],
      audience: platform.clientId,
      issuer: platform.issuer,
      subject: payload.sub
    });
    
    // 6. Verify LTI-specific claims
    // Check message type is LtiResourceLinkRequest
    if (verifiedToken['https://purl.imsglobal.org/spec/lti/claim/message_type'] !== 'LtiResourceLinkRequest') {
      return { 
        isValid: false, 
        error: 'Invalid LTI message type. Expected LtiResourceLinkRequest.' 
      };
    }
    
    // Check LTI version
    if (verifiedToken['https://purl.imsglobal.org/spec/lti/claim/version'] !== '1.3.0') {
      return { 
        isValid: false, 
        error: 'Unsupported LTI version. Expected 1.3.0.' 
      };
    }
    
    // Check deployment ID matches our records
    if (verifiedToken['https://purl.imsglobal.org/spec/lti/claim/deployment_id'] !== platform.deploymentId) {
      return { 
        isValid: false, 
        error: 'Invalid deployment ID.' 
      };
    }
    
    // 7. Verify nonce (if provided)
    if (expectedNonce && verifiedToken.nonce !== expectedNonce) {
      return { 
        isValid: false, 
        error: 'Invalid nonce value.' 
      };
    }
    
    // Success!
    return {
      isValid: true,
      payload: verifiedToken
    };
    
  } catch (error) {
    console.error('JWT validation error:', error);
    return {
      isValid: false,
      error: error.message
    };
  }
};