let requests = 0;

export const config = {
  runtime: 'nodejs18.x'
};

export default function handler(req, res) {
  requests++;
  const lines = [
    '# HELP http_requests_total The total number of HTTP requests.','
    '# TYPE http_requests_total counter',
    `http_requests_total ${requests}` ,
    '# HELP app_info Basic app info.',
    '# TYPE app_info gauge',
    'app_info{service="love-app",version="1.0"} 1'
  ];
  res.setHeader('Content-Type','text/plain; version=0.0.4');
  res.status(200).send(lines.join('
'));
}
