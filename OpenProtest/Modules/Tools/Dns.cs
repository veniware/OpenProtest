﻿using System;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;

public static class Dns {
    public static byte[] DnsLookup(string[] para) {
        if (para.Length < 2) return null;
        return DnsLookup(para[1]);
    }
    public static byte[] DnsLookup(string hostname) {
        try {
            string ips = "";
            foreach (IPAddress ip in System.Net.Dns.GetHostAddresses(hostname))
                ips += ip.ToString() + ((char)127).ToString();

            return Encoding.UTF8.GetBytes(ips);
        } catch { }

        return null;
    }
    public static async Task<string> DnsLookupAsync(IPAddress ip) { 
        try {
            return (await System.Net.Dns.GetHostEntryAsync(ip)).HostName;
        } catch {
            return "";
        }
    }
}