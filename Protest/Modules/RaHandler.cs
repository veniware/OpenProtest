﻿using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Threading;

public static class RaHandler {
    public static byte[] RaResponse(in string[] para, in string ip) {
        if (para.Length < 3) return Strings.INF.Array;
        return ip.StartsWith("127.") || ip == "::1" ? LocalAgent(para, ip) : RemoteAgent(para, ip);
    }

    public static byte[] LocalAgent(in string[] para, in string ip) {
        string method = para[1];
        string filename = para[2];
        string arg = (para.Length > 3) ? para[3] : String.Empty;
        string property = String.Empty;

        if (filename.Contains(":")) {
            property = filename.Split(':')[1];
            filename = filename.Split(':')[0];
        }

        if (filename.Length == 0) return Strings.INF.Array;

        Database.DbEntry entry;
        string hostname = String.Empty;

        if (method == "stpu") {
            if (!Database.users.ContainsKey(filename)) return Strings.FLE.Array;
            entry = (Database.DbEntry)Database.users[filename];

        } else {
            if (!Database.equip.ContainsKey(filename)) return Strings.FLE.Array;
            entry = (Database.DbEntry)Database.equip[filename];

            if (entry.hash.ContainsKey("IP")) hostname = ((string[])entry.hash["IP"])[0].Split(';')[0].Trim();
            else if (entry.hash.ContainsKey("HOSTNAME")) hostname = ((string[])entry.hash["HOSTNAME"])[0].Split(';')[0].Trim();
            if (hostname.Length == 0) return Strings.INF.Array;
        }

        switch (method) {

            case "vnc":
                try {
                    Process.Start(
                    $"{Environment.GetEnvironmentVariable("ProgramFiles")}\\uvnc bvba\\UltraVNC\\vncviewer.exe",
                    $"-autoscaling {hostname}");
                } catch (Exception ex) {
                    return Encoding.UTF8.GetBytes(ex.Message);
                }
                break;

            case "rdp":
                try {
                    Process.Start(
                    "mstsc",
                    $" /v {hostname}");
                } catch (Exception ex) {
                    return Encoding.UTF8.GetBytes(ex.Message);
                }
                break;

            case "pse":
                try {
                    string file = Path.GetTempPath() + DateTime.Now.Ticks + ".bat";
                    File.WriteAllText(
                        file,
                        $"ECHO OFF\ncls\npsexec \\\\{hostname} -u .\\administrator cmd.exe"
                    );

                    using (Process p = new Process()) {
                        p.StartInfo.FileName = "explorer.exe";
                        p.StartInfo.Arguments = file;
                        p.Start();
                    }

                    new Thread(() => {
                        Thread.Sleep(3000);
                        File.Delete(filename);
                    }).Start();

                } catch (Exception ex) {
                    return Encoding.UTF8.GetBytes(ex.Message);
                }
                break;

            case "smb":
                try {
                    using Process p = new Process();
                    p.StartInfo.FileName = "explorer.exe";
                    p.StartInfo.Arguments = $"\\\\{hostname}\\{arg.Replace("/", "\\")}";
                    p.StartInfo.UseShellExecute = true;
                    p.Start();
                } catch (Exception ex) {
                    return Encoding.UTF8.GetBytes(ex.Message);
                }
                break;

            case "cmg":
                try {
                    using Process p = new Process();
                    p.StartInfo.FileName = "compmgmt.msc";
                    p.StartInfo.Arguments = $"/computer=\"{hostname}\"";
                    p.StartInfo.UseShellExecute = true;
                    p.Start();
                } catch (Exception ex){
                    return Encoding.UTF8.GetBytes(ex.Message);
                }
                break;

            case "ssh":
                try {
                    using Process p = new Process();
                    p.StartInfo.FileName = "ssh";
                    p.StartInfo.Arguments = $"{hostname}";
                    p.StartInfo.UseShellExecute = true;
                    p.Start();
                } catch (Exception ex) {
                    return Encoding.UTF8.GetBytes(ex.Message);
                }
                break;

            case "winbox":
                return RemoteAgent(para, ip);

            case "stpe": //stamp equip?
                return RemoteAgent(para, ip);

            case "stpu": //stamp user?
                return RemoteAgent(para, ip);

            case "stp": //stamp
                return RemoteAgent(para, ip);
        }

        return Strings.OK.Array;
    }

    public static byte[] RemoteAgent(in string[] para, in string ip) {
        string method = para[1];
        string filename = para[2];
        string arg = (para.Length > 3) ? para[3] : String.Empty;
        string property = String.Empty;

        if (filename.Contains(":")) {
            property = filename.Split(':')[1];
            filename = filename.Split(':')[0];
        }

        byte[] payload;

        if (method == "stpe")
            payload = Encoding.UTF8.GetBytes(
                $"stp{(char)127}none{(char)127}" +
                Encoding.UTF8.GetString(Database.GetValue(Database.equip, filename, property))
            );

        else if (method == "stpu")
            payload = Encoding.UTF8.GetBytes(
                $"stp{(char)127}none{(char)127}" +
                Encoding.UTF8.GetString(Database.GetValue(Database.users, filename, property))
            );

        else if (method == "winbox") { //winbox
            if (filename.Length == 0) return Strings.INF.Array;
            if (!Database.equip.ContainsKey(filename)) return Strings.FLE.Array;

            Database.DbEntry entry = (Database.DbEntry)Database.equip[filename];

            string host = String.Empty;
            if (entry.hash.ContainsKey("IP")) host = ((string[])entry.hash["IP"])[0].Split(';')[0].Trim();
            else if (entry.hash.ContainsKey("HOSTNAME")) host = ((string[])entry.hash["HOSTNAME"])[0].Split(';')[0].Trim();
            if (host.Length == 0) return Strings.INF.Array;

            string[] overwriteProto = null;
            if (entry.hash.ContainsKey(".OVERWRITEPROTOCOL"))
                overwriteProto = ((string[])entry.hash[".OVERWRITEPROTOCOL"])[0].Trim().Split(';');
            else if (entry.hash.ContainsKey("OVERWRITEPROTOCOL"))
                overwriteProto = ((string[])entry.hash["OVERWRITEPROTOCOL"])[0].Trim().Split(';');

            int overwritePort = 0;
            for (int i = 0; i< overwriteProto?.Length; i++) {
                overwriteProto[i] = overwriteProto[i].Trim();
                if (!overwriteProto[i].StartsWith("winbox:")) continue;
                Int32.TryParse(overwriteProto[i].Substring(7).Trim(), out overwritePort);
                break;
            }

            if (overwritePort != 0) host += $":{overwritePort}";

            string username = entry.hash.ContainsKey("USERNAME") ? ((string[])entry.hash["USERNAME"])[0].Split(';')[0].Trim() : "admin";
            string password = entry.hash.ContainsKey("PASSWORD") ? ((string[])entry.hash["PASSWORD"])[0].Split(';')[0].Trim() : "";

            payload = Encoding.UTF8.GetBytes($"winbox{(char)127}{host + " " + username + " \"" + password + "\""}{(char)127}");

        } else {
            if (filename.Length == 0) return Strings.INF.Array;
            if (!Database.equip.ContainsKey(filename)) return Strings.FLE.Array;

            Database.DbEntry entry = (Database.DbEntry)Database.equip[filename];

            string host = String.Empty;
            if (entry.hash.ContainsKey("IP")) host = ((string[])entry.hash["IP"])[0].Split(';')[0].Trim();
            else if (entry.hash.ContainsKey("HOSTNAME")) host = ((string[])entry.hash["HOSTNAME"])[0].Split(';')[0].Trim();
            if (host.Length == 0) return Strings.INF.Array;

            string[] overwriteProto = null;
            if (entry.hash.ContainsKey(".OVERWRITEPROTOCOL"))
                overwriteProto = ((string[])entry.hash[".OVERWRITEPROTOCOL"])[0].Trim().Split(';');
            else if (entry.hash.ContainsKey("OVERWRITEPROTOCOL"))
                overwriteProto = ((string[])entry.hash["OVERWRITEPROTOCOL"])[0].Trim().Split(';');

            int overwritePort = 0;
            for (int i = 0; i < overwriteProto?.Length; i++) {
                overwriteProto[i] = overwriteProto[i].Trim();
                if (!overwriteProto[i].StartsWith($"{method}:")) continue;
                Int32.TryParse(overwriteProto[i].Substring(method.Length+1), out overwritePort);
                break;
            }

            if (overwritePort != 0) host += $":{overwritePort}";

            payload = Encoding.UTF8.GetBytes($"{method}{(char)127}{host}{(char)127}{arg}");
        }

        try {
            payload = CryptoAes.Encrypt(payload, Program.PRESHARED_KEY_A, Program.PRESHARED_KEY_B);
            TcpClient client = new TcpClient(ip, 5810);
            client.GetStream().Write(payload, 0, payload.Length);
            client.Close();
        } catch {
            return Strings.TCP.Array;
        }

        return Strings.OK.Array;
    }

}