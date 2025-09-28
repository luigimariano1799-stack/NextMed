// Placeholder serverless function for creating a Stripe Checkout session
// To enable: install stripe server SDK and set env var STRIPE_SECRET

exports.handler = async function(event, context){
  return {
    statusCode: 501,
    body: JSON.stringify({ error: 'Not implemented. Configure Stripe keys and implement create-checkout-session.' })
  };
};
