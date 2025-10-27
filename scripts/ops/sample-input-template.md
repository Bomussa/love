# Sample Input Template for replay-requests.cjs

## JSONL Format (Recommended)
Save as `requests.jsonl`:

```jsonl
{"method":"POST","endpoint":"/queue/enter","body":{"clinic":"lab","user":"P001"}}
{"method":"POST","endpoint":"/queue/enter","body":{"clinic":"xray","user":"P002"}}
{"method":"POST","endpoint":"/queue/done","body":{"clinic":"lab","user":"P001","pin":"1234"}}
```

## CSV Format
Save as `requests.csv`:

```csv
method,endpoint,body
POST,/queue/enter,"{""clinic"":""lab"",""user"":""P001""}"
POST,/queue/enter,"{""clinic"":""xray"",""user"":""P002""}"
POST,/queue/done,"{""clinic"":""lab"",""user"":""P001"",""pin"":""1234""}"
```

## Usage

1. Get your session cookie from browser:
   - Open DevTools (F12)
   - Go to Application > Cookies
   - Copy the session cookie value

2. Run the script:
   ```bash
   COOKIE="session=your-session-cookie-here" node scripts/ops/replay-requests.cjs requests.jsonl
   ```

3. With additional options:
   ```bash
   COOKIE="session=xyz" THROTTLE=500 BASE_URL="https://mmc-mms.com/api/v1" node scripts/ops/replay-requests.cjs requests.jsonl
   ```

4. Dry run (preview without sending):
   ```bash
   COOKIE="session=xyz" DRY_RUN=true node scripts/ops/replay-requests.cjs requests.jsonl
   ```

## Notes
- Each request automatically gets an idempotency key based on method + endpoint + body
- You can optionally provide a custom idempotency key in the input:
  ```jsonl
  {"method":"POST","endpoint":"/queue/enter","body":{"clinic":"lab","user":"P001"},"idempotencyKey":"custom_key_123"}
  ```
