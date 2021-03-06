﻿using System;
using System.Net;
using System.Net.Sockets;
using System.Text;

public static class WoL {

    public static byte[] Wakeup(in string[] para) {
        string filename = String.Empty;
        string mac = String.Empty;
        string ip = String.Empty;
        string mask = "255.255.255.0";

        for (int i = 1; i < para.Length; i++) {
            if (para[i].StartsWith("file=")) filename = para[i].Substring(5);
            if (para[i].StartsWith("mac=")) mac = para[i].Substring(4);
            if (para[i].StartsWith("ip=")) ip = para[i].Substring(3);
            if (para[i].StartsWith("mask=")) mask = para[i].Substring(5);
        }

        if (Database.equip.ContainsKey(filename)) {
            Database.DbEntry entry = (Database.DbEntry)Database.equip[filename];

            if (entry.hash.ContainsKey("MAC ADDRESS")) mac = ((string[])entry.hash["MAC ADDRESS"])[0];
            if (entry.hash.ContainsKey("IP")) ip = ((string[])entry.hash["IP"])[0];
            if (entry.hash.ContainsKey("MASK")) mask = ((string[])entry.hash["MASK"])[0];
        }

        if (ip.Length == 0 || mac.Length == 0) return Strings.INF.Array;

        return Wakeup(mac, ip, mask);
    }

    public static byte[] Wakeup(in string mac, string ip, string mask) {
        if (ip.Contains(";")) ip = ip.Substring(0, ip.IndexOf(";")).Trim();
        if (mask.Contains(";")) mask = mask.Substring(0, mask.IndexOf(";")).Trim();
        
        try {
            return Wakeup(mac, IPAddress.Parse(ip), IPAddress.Parse(mask));
        } catch (Exception ex) {
            return Encoding.UTF8.GetBytes(ex.Message);
        }       
    }

    public static byte[] Wakeup(string mac, IPAddress ip, IPAddress mask) {
        if (mac.Contains(";")) mac = mac.Split(';')[0].Trim();

        string[] macDigits;
        if (mac.Contains("-"))
            macDigits = mac.Split('-');
        else if (mac.Contains(":"))
            macDigits = mac.Split(':');
        else if (mac.Length == 12)
            macDigits = new string[] { mac.Substring(0, 2), mac.Substring(2, 2), mac.Substring(4, 2), mac.Substring(6, 2), mac.Substring(8, 2), mac.Substring(10, 2) };
        else
            return Encoding.UTF8.GetBytes("Invalid MAC Address");

        if (macDigits.Length != 6) return Encoding.UTF8.GetBytes("Invalid MAC Address");

        byte[] datagram = new byte[512];

        for (int i = 1; i < 6; i++)
            datagram[i] = 0xff;

        for (int i = 0; i < 16; i++)
            for (int j = 0; j < 6; j++)
                datagram[6 + i * 6 + j] = Convert.ToByte(macDigits[j], 16);

        for (int i = datagram.Length - 7; i < datagram.Length; i++)
            datagram[i] = 0;

        try {
            IPAddress broadcast = IpTools.GetBroadcastAddress(ip, mask);

            using UdpClient client = new UdpClient();
            client.Send(datagram, datagram.Length, broadcast.ToString(), 1);
            client.Send(datagram, datagram.Length, "255.255.255.255", 1);

        } catch {
            return Strings.FAI.Array;
        }

        return Strings.OK.Array;
    }

}