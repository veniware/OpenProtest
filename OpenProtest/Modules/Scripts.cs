﻿using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.DirectoryServices;
using System.Net;
using System.Net.NetworkInformation;
using System.IO;

static class Scripts {

    static readonly string DIR_SCRIPTS = $"{Directory.GetCurrentDirectory()}\\scripts";
    static readonly string DIR_SCRIPTS_SCRIPTS = $"{Directory.GetCurrentDirectory()}\\scripts\\scripts";
    static readonly string DIR_SCRIPTS_REPORTS = $"{Directory.GetCurrentDirectory()}\\scripts\\reports";


    public static byte[] GetEquipColumns() {
        Hashtable hash = new Hashtable();
        StringBuilder sb = new StringBuilder();

        foreach (DictionaryEntry o in NoSQL.equip) {
            NoSQL.DbEntry entry = (NoSQL.DbEntry)o.Value;
            foreach (DictionaryEntry c in entry.hash) {
                string k = c.Key.ToString();
                if (hash.ContainsKey(k)) continue;
                hash.Add(k, null);
                sb.Append(sb.Length == 0 ? k : $"{(char)127}{k}");
            }
        }

        hash.Clear();
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public static byte[] GetUserColumns() {
        Hashtable hash = new Hashtable();
        StringBuilder sb = new StringBuilder();

        foreach (DictionaryEntry o in NoSQL.users) {
            NoSQL.DbEntry entry = (NoSQL.DbEntry)o.Value;
            foreach (DictionaryEntry c in entry.hash) {
                string k = c.Key.ToString();
                if (hash.ContainsKey(k)) continue;
                hash.Add(k, null);
                sb.Append(sb.Length == 0 ? k : $"{(char)127}{k}");
            }
        }

        hash.Clear();
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public static byte[] GetAdUserColumns() {
        Hashtable hash = new Hashtable();
        StringBuilder sb = new StringBuilder();

        string domain = null;
        try {
            domain = IPGlobalProperties.GetIPGlobalProperties()?.DomainName ?? null;
        } catch { }

        SearchResultCollection result = null;

        try {
            DirectoryEntry dir = ActiveDir.GetDirectoryEntry(domain);
            DirectorySearcher searcher = new DirectorySearcher(dir);
            searcher.Filter = "(&(objectClass=user)(objectCategory=person))";
            result = searcher.FindAll();
        } catch (Exception ex) {
            ErrorLog.Err(ex);
            return null;
        }

        if (result is null || result.Count == 0) return null;

        foreach (SearchResult o in result)
            foreach (DictionaryEntry e in o.Properties) {
                if (hash.ContainsKey(e.Key)) continue;
                hash.Add(e.Key, null);
                sb.Append(sb.Length == 0 ? e.Key : $"{(char)127}{e.Key}");
            }

        hash.Clear();
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public static byte[] GetAdWorkstationColumns() {
        Hashtable hash = new Hashtable();
        StringBuilder sb = new StringBuilder();

        string domain = null;
        try {
            domain = IPGlobalProperties.GetIPGlobalProperties()?.DomainName ?? null;
        } catch { }

        SearchResultCollection result = null;

        try {
            DirectoryEntry dir = ActiveDir.GetDirectoryEntry(domain);
            DirectorySearcher searcher = new DirectorySearcher(dir);
            searcher.Filter = "(objectClass=computer)";
            result = searcher.FindAll();
        } catch (Exception ex) {
            ErrorLog.Err(ex);
            return null;
        }

        if (result is null || result.Count == 0) return null;

        foreach (SearchResult o in result) 
            foreach (DictionaryEntry e in o.Properties) { 
                if (hash.ContainsKey(e.Key)) continue;
                hash.Add(e.Key, null);
                sb.Append(sb.Length == 0 ? e.Key : $"{(char)127}{e.Key}");
            }        

        hash.Clear();
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public static byte[] GetAdGroupColumns() {
        Hashtable hash = new Hashtable();
        StringBuilder sb = new StringBuilder();

        string domain = null;
        try {
            domain = IPGlobalProperties.GetIPGlobalProperties()?.DomainName ?? null;
        } catch { }

        SearchResultCollection result = null;

        try {
            DirectoryEntry dir = ActiveDir.GetDirectoryEntry(domain);
            DirectorySearcher searcher = new DirectorySearcher(dir);
            searcher.Filter = "(&(objectClass=group))";
            result = searcher.FindAll();
        } catch (Exception ex) {
            ErrorLog.Err(ex);
            return null;
        }

        if (result is null || result.Count == 0) return null;

        foreach (SearchResult o in result)
            foreach (DictionaryEntry e in o.Properties) {
                if (hash.ContainsKey(e.Key)) continue;
                hash.Add(e.Key, null);
                sb.Append(sb.Length == 0 ? e.Key : $"{(char)127}\n{e.Key}");
            }

        hash.Clear();
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public static byte[] LoadScript(in HttpListenerContext ctx) {


        return null;
    }

    public static byte[] SaveScript(in HttpListenerContext ctx) {
        DirectoryInfo dir = new DirectoryInfo(DIR_SCRIPTS);
        if (!dir.Exists) dir.Create();

        DirectoryInfo dir_scripts = new DirectoryInfo(DIR_SCRIPTS_SCRIPTS);
        if (!dir_scripts.Exists) dir_scripts.Create();

        DirectoryInfo dir_reports = new DirectoryInfo(DIR_SCRIPTS_REPORTS);
        if (!dir_reports.Exists) dir_reports.Create();


        string payload;
        using (StreamReader reader = new StreamReader(ctx.Request.InputStream, ctx.Request.ContentEncoding))
            payload = reader.ReadToEnd();
               
        if (payload.Length == 0) return Tools.INV.Array;

        //...

        string[] lines = payload.Split("\n".ToCharArray(), StringSplitOptions.RemoveEmptyEntries);

        for (int i=0; i< lines.Length; i++) {
            string[] split = lines[i].Split((char)127);

            if (split[0] == "n") { //node

            } else if (split[0] == "l") { //link

            }
        }

        Console.WriteLine(payload);

        return null;
    }

    public static byte[] RunScript(in string[] para) {
        string filename = "";
        for (int i = 1; i < para.Length; i++) 
            if (para[i].StartsWith("filename=")) filename = para[i].Substring(9);

        return RunScript(filename);
    }
    public static byte[] RunScript(in string filename) {


        return null;
    }

}