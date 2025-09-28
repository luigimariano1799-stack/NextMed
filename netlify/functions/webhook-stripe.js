// Placeholder webhook receiver for Stripe events
exports.handler = async function(event, context){
  return { statusCode: 501, body: JSON.stringify({ error: 'Not implemented. Configure Stripe webhook and secret.' }) };
};
