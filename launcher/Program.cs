using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PaperOS.Launcher;

internal static class Program
{
    private const int DefaultPort = 3719;

    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);

        string root = AppContext.BaseDirectory;
        // Prefer repo root when running from published folder beside app/
        if (!File.Exists(Path.Combine(root, "app", "server.mjs")))
        {
            string parent = Directory.GetParent(root)?.FullName ?? root;
            if (File.Exists(Path.Combine(parent, "app", "server.mjs"))) root = parent;
        }

        string server = Path.Combine(root, "app", "server.mjs");
        if (!File.Exists(server))
        {
            MessageBox.Show(
                "找不到 app/server.mjs。请把 PaperOS.exe 放在项目根目录运行。",
                "Paper OS",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        string? node = FindOnPath("node.exe");
        if (node is null)
        {
            MessageBox.Show(
                "需要 Node.js 20+。请先安装 Node 后再启动 Paper OS。",
                "Paper OS",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        string nodeVersion = ReadNodeVersion(node);
        if (!NodeVersionSupported(nodeVersion))
        {
            MessageBox.Show(
                $"需要 Node.js 20+，当前: {nodeVersion}",
                "Paper OS",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        int port = ResolvePort();
        Process? serverProcess = null;
        try
        {
            if (!IsPaperOsHealthy(port))
            {
                serverProcess = StartServer(node, root, port);
                WaitForServerHealth(port, TimeSpan.FromSeconds(20));
            }

            string ideUrl = $"http://127.0.0.1:{port}/ide/";
            Application.Run(new IdeForm(ideUrl, serverProcess));
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Paper OS", MessageBoxButtons.OK, MessageBoxIcon.Error);
            if (serverProcess is { HasExited: false })
            {
                try { serverProcess.Kill(entireProcessTree: true); } catch { /* */ }
            }
        }
    }

    private sealed class IdeForm : Form
    {
        private readonly string _url;
        private readonly Process? _server;
        private readonly WebView2 _webView = new() { Dock = DockStyle.Fill };

        public IdeForm(string url, Process? server)
        {
            _url = url;
            _server = server;
            Text = "Paper OS";
            Width = 1440;
            Height = 900;
            MinimumSize = new Size(1100, 720);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(12, 12, 15);
            Controls.Add(_webView);
            Load += async (_, _) => await InitWebView();
            FormClosed += (_, _) =>
            {
                if (_server is { HasExited: false })
                {
                    try { _server.Kill(entireProcessTree: true); } catch { /* */ }
                }
            };
        }

        private async Task InitWebView()
        {
            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "PaperOS", "WebView2"));
                await _webView.EnsureCoreWebView2Async(env);
                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
                _webView.CoreWebView2.Navigate(_url);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "WebView2 初始化失败。请安装 Microsoft Edge WebView2 Runtime。\n\n" + ex.Message,
                    "Paper OS",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Close();
            }
        }
    }

    private static int ResolvePort()
    {
        string? raw = Environment.GetEnvironmentVariable("PAPER_OS_PORT");
        if (int.TryParse(raw, out int configuredPort) && configuredPort > 0) return configuredPort;
        if (!IsPortOpen(DefaultPort) || IsPaperOsHealthy(DefaultPort)) return DefaultPort;
        return FindFreePort();
    }

    private static Process StartServer(string node, string root, int port)
    {
        ProcessStartInfo startInfo = new()
        {
            FileName = node,
            Arguments = "app/server.mjs",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        startInfo.Environment["PAPER_OS_PORT"] = port.ToString();
        startInfo.Environment["PAPER_OS_DESKTOP"] = "1";
        Process? process = Process.Start(startInfo);
        return process ?? throw new InvalidOperationException("无法启动本地服务。");
    }

    private static string ReadNodeVersion(string node)
    {
        try
        {
            ProcessStartInfo startInfo = new()
            {
                FileName = node,
                Arguments = "--version",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
            };
            using Process? process = Process.Start(startInfo);
            if (process is null) return "unknown";
            string output = process.StandardOutput.ReadToEnd().Trim();
            process.WaitForExit(3000);
            return string.IsNullOrWhiteSpace(output) ? "unknown" : output;
        }
        catch { return "unknown"; }
    }

    private static bool NodeVersionSupported(string version)
    {
        if (string.IsNullOrWhiteSpace(version) || !version.StartsWith("v", StringComparison.OrdinalIgnoreCase))
            return false;
        string majorText = version.TrimStart('v').Split('.')[0];
        return int.TryParse(majorText, out int major) && major >= 20;
    }

    private static int FindFreePort()
    {
        TcpListener listener = new(IPAddress.Loopback, 0);
        listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static void WaitForServerHealth(int port, TimeSpan timeout)
    {
        Stopwatch watch = Stopwatch.StartNew();
        while (watch.Elapsed < timeout)
        {
            if (IsPaperOsHealthy(port)) return;
            Thread.Sleep(300);
        }
        throw new TimeoutException("本地 Paper OS 服务启动超时。");
    }

    private static bool IsPortOpen(int port)
    {
        try
        {
            using TcpClient client = new();
            IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
            bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(250));
            if (!success) return false;
            client.EndConnect(result);
            return true;
        }
        catch { return false; }
    }

    private static bool IsPaperOsHealthy(int port)
    {
        try
        {
            using HttpClient client = new() { Timeout = TimeSpan.FromMilliseconds(900) };
            using HttpResponseMessage response = client.GetAsync($"http://127.0.0.1:{port}/api/health").GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode) return false;
            string body = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return body.Contains("\"ok\": true", StringComparison.OrdinalIgnoreCase)
                && body.Contains("Paper OS", StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    private static string? FindOnPath(string executable)
    {
        string? path = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrWhiteSpace(path)) return null;
        foreach (string directory in path.Split(Path.PathSeparator))
        {
            if (string.IsNullOrWhiteSpace(directory)) continue;
            string candidate = Path.Combine(directory.Trim(), executable);
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }
}
