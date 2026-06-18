using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;

namespace MathModelingPaperOS.Launcher;

internal static class Program
{
    private const int DefaultPort = 3719;
    private const uint MbIconError = 0x00000010;
    private const uint MbIconInformation = 0x00000040;

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    [STAThread]
    private static int Main()
    {
        string root = AppContext.BaseDirectory;
        string server = Path.Combine(root, "app", "server.mjs");
        if (!File.Exists(server))
        {
            ShowMessage(
                "app/server.mjs was not found. Run this launcher from the Math Modeling Paper OS folder.",
                MbIconError);
            return 2;
        }

        string? node = FindOnPath("node.exe");
        if (node is null)
        {
            ShowMessage(
                "Node.js 20+ is required. Install Node.js or use the portable folder on a machine with Node available.",
                MbIconError);
            return 2;
        }
        string nodeVersion = ReadNodeVersion(node);
        if (!NodeVersionSupported(nodeVersion))
        {
            ShowMessage(
                $"Node.js 20+ is required. Detected: {nodeVersion}. Install Node.js 20+ and restart Math Modeling Paper OS.",
                MbIconError);
            return 2;
        }

        int port = ResolvePort();
        string url = $"http://127.0.0.1:{port}";
        Process? serverProcess = null;

        try
        {
            if (!IsPaperOsHealthy(port))
            {
                serverProcess = StartServer(node, root, port);
                WaitForServerHealth(port, TimeSpan.FromSeconds(18));
            }

            OpenBrowser(url);
            ShowMessage(
                $"Math Modeling Paper OS is running at {url}.\n\nNode: {nodeVersion}\n\nClose this window to stop the local service started by this launcher.",
                MbIconInformation);
            return 0;
        }
        catch (Exception ex)
        {
            ShowMessage(ex.Message, MbIconError);
            return 1;
        }
        finally
        {
            if (serverProcess is { HasExited: false })
            {
                serverProcess.Kill(entireProcessTree: true);
            }
        }
    }

    private static void ShowMessage(string message, uint icon)
    {
        MessageBoxW(IntPtr.Zero, message, "Math Modeling Paper OS", icon);
    }

    private static int ResolvePort()
    {
        string? raw = Environment.GetEnvironmentVariable("PAPER_OS_PORT");
        if (int.TryParse(raw, out int configuredPort) && configuredPort > 0)
        {
            return configuredPort;
        }
        if (!IsPortOpen(DefaultPort) || IsPaperOsHealthy(DefaultPort))
        {
            return DefaultPort;
        }
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

        Process? process = Process.Start(startInfo);
        if (process is null)
        {
            throw new InvalidOperationException("Failed to start the local server.");
        }
        return process;
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
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            using Process? process = Process.Start(startInfo);
            if (process is null) return "unknown";
            string output = process.StandardOutput.ReadToEnd().Trim();
            process.WaitForExit(3000);
            return string.IsNullOrWhiteSpace(output) ? "unknown" : output;
        }
        catch
        {
            return "unknown";
        }
    }

    private static bool NodeVersionSupported(string version)
    {
        if (string.IsNullOrWhiteSpace(version) || !version.StartsWith("v", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
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
            Thread.Sleep(350);
        }
        throw new TimeoutException("The local Paper OS server did not become healthy in time.");
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
        catch
        {
            return false;
        }
    }

    private static bool IsPaperOsHealthy(int port)
    {
        try
        {
            using HttpClient client = new()
            {
                Timeout = TimeSpan.FromMilliseconds(900),
            };
            using HttpResponseMessage response = client.GetAsync($"http://127.0.0.1:{port}/api/health").GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode) return false;
            string body = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return body.Contains("\"ok\": true", StringComparison.OrdinalIgnoreCase)
                && body.Contains("\"name\": \"Math Modeling Paper OS\"", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static void OpenBrowser(string url)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true,
        });
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
