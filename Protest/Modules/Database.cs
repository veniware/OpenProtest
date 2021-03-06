﻿using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;

class Database {
    public struct DbEntry {
        public string    filename;
        public bool      isUser;
        public Hashtable hash;       //[value, performer/date, source]
        public object    write_lock;
    }

    public enum SaveMethod {
        Skip      = 0,
        CreateNew = 1,
        Overwrite = 2,
        Append    = 3,
        Merge     = 4
    }

    public static long equipVer = 0;
    public static long usersVer = 0;
    public static Hashtable equip = Hashtable.Synchronized(new Hashtable());
    public static Hashtable users = Hashtable.Synchronized(new Hashtable());

    public static long lastCachedEquipVer = -1;
    public static long lastCachedUsersVer = -1;
    public static long lastCachedEquipTimestamp = 0;
    public static long lastCachedUsersTimestamp = 0;
    public static byte[] lastCachedEquip = null;
    public static byte[] lastCachedUsers = null;
    public static byte[] lastCachedEquipGzip = null;
    public static byte[] lastCachedUsersGzip = null;

    public static void LoadEquip() {
        DirectoryInfo dir = new DirectoryInfo(Strings.DIR_EQUIP);
        if (!dir.Exists) return;

        FileInfo[] files = dir.GetFiles();
        for (int i=0; i<files.Length; i++) {
            Program.ProgressBar(i * 100 / files.Length, "Loading equipment");
            DbEntry entry = Read(files[i], false);
            if (entry.hash == null) continue;
            equip.Add(files[i].Name, entry);
        }

        Program.ProgressBar(100, "Loading equipment", true);
        equipVer = DateTime.Now.Ticks;
    }

    public static void LoadUsers() {
        DirectoryInfo dir = new DirectoryInfo(Strings.DIR_USERS);
        if (!dir.Exists) return;

        FileInfo[] files = dir.GetFiles();
        for (int i = 0; i < files.Length; i++) {
            Program.ProgressBar(i * 100 / files.Length, "Loading user");
            DbEntry entry = Read(files[i], true);
            if (entry.hash == null) continue;            
            users.Add(files[i].Name, entry);
        }

        Program.ProgressBar(100, "Loading user", true);
        usersVer = DateTime.Now.Ticks;
    }

    public static DbEntry Read(FileInfo f, bool isUser) {
        DbEntry entry = new DbEntry() {
            filename = f.Name,
            hash = new Hashtable(),
            isUser = isUser,
            write_lock = new object()
        };

        try {
            if (f.Length < 2) throw new Exception("null file: " + f.FullName);
            byte[] bytes = File.ReadAllBytes(f.FullName);

            string plain = Encoding.UTF8.GetString(CryptoAes.Decrypt(bytes, Program.DB_KEY_A, Program.DB_KEY_B));
            string[] split = plain.Split((char)127);

            entry.hash.Add(".FILENAME", new string[] { f.Name, "", "" });

            for (int i = 0; i < split.Length - 3; i += 4)
                if (!entry.hash.ContainsKey(split[i]))
                    entry.hash.Add(split[i], new string[] { split[i + 1], split[i + 2], split[i + 3] });

        } catch (IOException ex) {
            entry.hash = null;
            Logging.Err(ex);

        } catch (Exception ex) {
            entry.hash = null;
            Logging.Err(ex);
        }

        return entry;
    }

    public static bool Write(DbEntry e, in string performer) {
        if (!e.hash.ContainsKey(".FILENAME")) return false;
        string filename = ((string[])e.hash[".FILENAME"])[0];

        byte[] plain = GetEntryPayload(e);
        byte[] cipher = CryptoAes.Encrypt(plain, Program.DB_KEY_A, Program.DB_KEY_B);

        byte[] bytes = new byte[cipher.Length];
        Array.Copy(cipher, 0, bytes, 0, cipher.Length);

        try {
            lock (e.write_lock)
                File.WriteAllBytes($"{(e.isUser ? Strings.DIR_USERS : Strings.DIR_EQUIP)}\\{filename}", bytes);
        } catch (Exception ex) {
            Logging.Err(ex);
            return false;
        }

        //if (!(performer is null)) Logging.Action(in performer, $"DB write: {(e.isUser ? "user" : "equip")} {filename}");

        return true;
    }

    public static byte[] GetEntryPayload(in DbEntry entry) {
        StringBuilder payload = new StringBuilder();

        foreach (DictionaryEntry o in entry.hash) {
            string key = o.Key.ToString();
            if (key.Length == 0) continue;
            string[] value = (string[])o.Value;
            payload.Append($"{key}{(char)127}{value[0]}{(char)127}{value[1]}{(char)127}{value[2]}{(char)127}"); //[property name] [value] [performer] [placeholder]
        }

        return Encoding.UTF8.GetBytes(payload.ToString());
    }

    public static byte[] GetTable(Hashtable table, long version) {
        StringBuilder sb = new StringBuilder($"{version}{(char)127}");

        foreach (DictionaryEntry o in table) {
            DbEntry entry = (DbEntry)o.Value;

            string line = String.Empty;
            int entry_count = 0;

            foreach (DictionaryEntry c in entry.hash) {
                string k = c.Key.ToString();
                string[] v = (string[])c.Value;

                if (k.Contains("PASSWORD")) //filter out the passwords
                    line += k + (char)127 + (char)127 + v[1] + (char)127 + v[2] + (char)127;
                else
                    line += k + (char)127 + v[0] + (char)127 + v[1] + (char)127 + v[2] + (char)127;

                entry_count++;
            }
            sb.Append(entry_count.ToString() + (char)127 + line);
        }

        return Encoding.Default.GetBytes(sb.ToString());
    }

    public static byte[] GetEquipTable(bool gzip = false) {
        if (lastCachedEquipVer < equipVer) {
            lastCachedEquip = GetTable(equip, equipVer);
            lastCachedEquipGzip = Cache.GZip(lastCachedEquip);
            lastCachedEquipVer = equipVer;
        }

        if (gzip)
            return lastCachedEquipGzip;
        else
            return lastCachedEquip;
    }
    public static byte[] GetUsersTable(bool gzip = false) {
        if (lastCachedUsersVer < usersVer) {
            lastCachedUsers = GetTable(users, usersVer);
            lastCachedUsersGzip = Cache.GZip(lastCachedUsers);
            lastCachedUsersVer = usersVer;
        }

        if (gzip)
            return lastCachedUsersGzip;
        else 
            return lastCachedUsers;
    }

    public static bool SaveEntry(string[] array, string filename, SaveMethod method, in string performer, bool isUser) {
        Hashtable hash = new Hashtable();
        for (int i = 0; i < array.Length - 1; i += 2) { //copy from array to hash
            array[i] = array[i].ToUpper();
            if (hash.ContainsKey(array[i])) continue;
            if ((filename is null || filename.Length == 0) && array[i] == ".FILENAME") filename = array[i + 1];
            hash.Add(array[i], new string[] { array[i + 1], $"{performer}, { DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });
        }

        return SaveEntry(hash, filename, method, performer, isUser);
    }

    public static bool SaveEntry(Hashtable hash, string filename, SaveMethod method, in string performer, bool isUser) {
        if (filename is null || filename.Length == 0) filename = DateTime.Now.Ticks.ToString();
        bool exists = isUser ? users.ContainsKey(filename) : equip.ContainsKey(filename);

        DbEntry entry;
        if (exists)
            entry = isUser ? (DbEntry)users[filename] : (DbEntry)equip[filename];
        else
            entry = new DbEntry() {
                filename = DateTime.Now.Ticks.ToString(),
                hash = hash,
                isUser = isUser,
                write_lock = new object()
            };


        if (!exists) { //if don't exists, add to db
            if (isUser) {
                users.Add(filename, entry);
                usersVer = DateTime.Now.Ticks;
            } else {
                equip.Add(filename, entry);
                equipVer = DateTime.Now.Ticks;
            }

            if (!entry.hash.ContainsKey(".FILENAME"))
                entry.hash.Add(".FILENAME", new string[] { filename, "", "" });

            Write(entry, in performer);
            Logging.Action(in performer, $"Create {(entry.isUser ? "user" : "equip")}: {filename}");
            return true;
        }


        switch (method) { //if do exists
            case SaveMethod.Skip: //Ignore            
                return true;

            case SaveMethod.CreateNew: { //keep the old one and create new
                filename = new DateTime().Ticks.ToString();
                entry.hash[".FILENAME"] = new string[] { filename, "", "" };
                Write(entry, in performer);
                Logging.Action(in performer, $"Overwrite {(entry.isUser ? "user" : "equip")}: {filename}");
                break;
            }

            case SaveMethod.Overwrite: { //overwrite the old file
                List<string> removed = new List<string>();
                foreach (DictionaryEntry o in entry.hash) if (!hash.ContainsKey(o.Key)) removed.Add(o.Key.ToString()); //list properties that have been removed

                lock (entry.write_lock) {
                    foreach (string o in removed) entry.hash.Remove(o); //remove deleted properties

                    foreach (DictionaryEntry o in hash)
                        if (entry.hash.ContainsKey(o.Key)) {
                            string[] old = (string[])entry.hash[o.Key];
                            entry.hash[o.Key] = (old[0] == ((string[])hash[o.Key])[0]) ? old : new string[] { ((string[])o.Value)[0], $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" };
                        } else
                            entry.hash.Add(o.Key, new string[] { ((string[])o.Value)[0], $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });
                }
                Write(entry, in performer); //Write uses its own lock
                Logging.Action(in performer, $"Overwrite {(entry.isUser ? "user" : "equip")}: {filename}");

                removed.Clear();
                break;
            }
            
            case SaveMethod.Append: { //append only new properties
                lock (entry.write_lock) 
                    foreach (DictionaryEntry o in hash)
                        if (!entry.hash.ContainsKey(o.Key)) 
                            entry.hash.Add(o.Key, new string[] { ((string[])o.Value)[0], $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });
                
                Write(entry, in performer); //Write uses its own lock
                Logging.Action(in performer, $"Overwrite {(entry.isUser ? "user" : "equip")}: {filename}");
                break;
            }

            case SaveMethod.Merge: { //add all fetched properties and keep old properties that doesn't conflict
                lock (entry.write_lock) 
                    foreach (DictionaryEntry o in hash)
                        if (entry.hash.ContainsKey(o.Key)) {
                            string[] old = (string[])entry.hash[o.Key];
                            entry.hash[o.Key] = (old[0] == ((string[])hash[o.Key])[0]) ? old : new string[] { ((string[])o.Value)[0], $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" };
                        } else
                            entry.hash.Add(o.Key, new string[] { ((string[])o.Value)[0], $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });
                
                Write(entry, in performer); //Write uses its own lock
                Logging.Action(in performer, $"Overwrite {(entry.isUser ? "user" : "equip")}: {filename}");
                break;
            }
        }

        if (isUser)
            usersVer = DateTime.Now.Ticks;
        else
            equipVer = DateTime.Now.Ticks;

        return true;
    }

    public static byte[] GetValue(Hashtable table, in string[] para) {
        string filename = String.Empty;
        string property = String.Empty;
        for (int i = 1; i < para.Length; i++)
            if (para[i].StartsWith("file=")) filename = para[i].Substring(5);
            else if (para[i].StartsWith("property=")) property = para[i].Substring(9);
        
        return GetValue(table, filename, property);
    }
    public static byte[] GetValue(Hashtable table, in string filename, string property) {
        if (filename.Length == 0) return null;
        if (property.Length == 0) return null;

        property = Strings.DecodeUrl(property);

        if (!table.ContainsKey(filename)) return null;
        DbEntry entry = (DbEntry)table[filename];

        return GetValue(entry, property);
    }
    public static byte[] GetValue(DbEntry entry, in string property) {
#if DEBUG
        return Encoding.UTF8.GetBytes("[debug-mode]");
#else
        if (!entry.hash.ContainsKey(property)) return new byte[] { };
        string[] value = (string[])entry.hash[property];
        return Encoding.UTF8.GetBytes(value[0]);
#endif
    }

    public static byte[] SaveEquip(in HttpListenerContext ctx, in string performer) {
        string payload;
        using (StreamReader reader = new StreamReader(ctx.Request.InputStream, ctx.Request.ContentEncoding))
            payload = reader.ReadToEnd();

        if (payload.Length == 0) return Strings.INV.Array;

        string[] split = payload.Split((char)127);
        if (split.Length < 4) return Strings.INF.Array;

        Hashtable payloadHash = new Hashtable(); //payload as string

        string filename = String.Empty;
        for (int i = 0; i < split.Length - 1; i += 2) {
            split[i] = split[i].ToUpper();
            if (split[i] == ".FILENAME") filename = split[i+1];

            if (payloadHash.ContainsKey(split[i])) //if property exists append on it
                payloadHash[split[i]] = $"{payloadHash[split[i]]}; {split[i+1]}";
            else
                payloadHash.Add(split[i], split[i+1]);
        }

        if (filename.Length == 0) filename = DateTime.Now.Ticks.ToString();

        DbEntry entry;
        bool exists = equip.ContainsKey(filename);
        if (exists) { //existing entry
            entry = (DbEntry)equip[filename];

        } else { //new entry
            entry = new DbEntry() {
                filename = DateTime.Now.Ticks.ToString(),
                hash = new Hashtable(),
                isUser = false,
                write_lock = new object()
            };

            foreach (DictionaryEntry o in payloadHash)
                entry.hash.Add(o.Key, new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });

            equip.Add(filename, entry);
        }

        List<string> remove = new List<string>();
        foreach (DictionaryEntry o in entry.hash) if (!payloadHash.ContainsKey(o.Key)) remove.Add(o.Key.ToString());
        foreach (string o in remove) entry.hash.Remove(o);
        remove.Clear();
                
        foreach (DictionaryEntry o in payloadHash)
            if (entry.hash.ContainsKey(o.Key)) { //overwrite property
                string key = (string)o.Key;
                string[] current = (string[])entry.hash[key];
                if (key.Contains("PASSWORD")) { //if null, keep old value
                    if (o.Value.ToString().Length > 0) entry.hash[o.Key] = (current[0] == (string)payloadHash[o.Key]) ? current : new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" };
                } else
                    entry.hash[o.Key] = (current[0] == (string)payloadHash[o.Key]) ? current : new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" };

            } else {//new property
                entry.hash.Add(o.Key, new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });
            }
        
        //if hash don't have ".FILENAME" property, create one
        if (!entry.hash.ContainsKey(".FILENAME")) entry.hash.Add(".FILENAME", new string[] { filename, "", "" });

        Write(entry, in performer); //Write() uses its own lock
        equipVer = DateTime.Now.Ticks;
        Logging.Action(in performer, $"{(exists ? "Overwrite" : "Create")} equip: {filename}");

        StringBuilder broadcast = new StringBuilder();
        broadcast.Append("{");
        broadcast.Append("\"action\":\"update\",");
        broadcast.Append("\"type\":\"equip\",");
        broadcast.Append($"\"target\":\"{filename}\",");
        broadcast.Append($"\"performer\":\"{performer}\",");
        broadcast.Append($"\"version\":\"{equipVer}\",");

        broadcast.Append("\"obj\":{");
        bool fst = true;
        foreach (DictionaryEntry o in entry.hash) {
            if (!fst) broadcast.Append(",");
            string key = (string)o.Key;
            string[] current = (string[])entry.hash[key];
            broadcast.Append($"\"{Strings.EscapeJson(key)}\":");

            if (key.Contains("PASSWORD"))
                broadcast.Append($"[\"\",\"{Strings.EscapeJson(current[1])}\"]");
            else
                broadcast.Append($"[\"{Strings.EscapeJson(current[0])}\",\"{Strings.EscapeJson(current[1])}\"]");

            fst = false;
        }
        broadcast.Append("}");

        broadcast.Append("}");

        byte[] bytes = Encoding.UTF8.GetBytes(broadcast.ToString());
        KeepAlive.Broadcast(bytes);
        return bytes;
    }

    public static byte[] DeleteEquip(in string[] para, in string performer) {
        string filename;
        if (para.Length > 1)
            filename = para[1];
        else
            return Strings.INV.Array;

        if (equip.ContainsKey(filename)) {
            DbEntry entry = (DbEntry)equip[filename];
            lock (entry.write_lock) {
                try {
                    string fullpath = $"{Strings.DIR_EQUIP}_del";
                    DirectoryInfo dir = new DirectoryInfo(fullpath);
                    if (!dir.Exists) dir.Create();

                    File.Move($"{Strings.DIR_EQUIP}\\{filename}", $"{fullpath}\\{filename}");
                    equip.Remove(filename);

                } catch (Exception ex) {
                    Logging.Err(ex);
                }
            }

            Logging.Action(in performer, $"Delete equip: {filename}");

            equipVer = DateTime.Now.Ticks;

            StringBuilder broadcast = new StringBuilder();
            broadcast.Append("{");
            broadcast.Append("\"action\":\"delete\",");
            broadcast.Append("\"type\":\"equip\",");
            broadcast.Append($"\"target\":\"{filename}\",");
            broadcast.Append($"\"performer\":\"{performer}\",");
            broadcast.Append($"\"version\":\"{equipVer}\"");
            broadcast.Append("}");

            byte[] bytes = Encoding.UTF8.GetBytes(broadcast.ToString());
            KeepAlive.Broadcast(bytes);

            return Strings.OK.Array;
        } else
            return Strings.FLE.Array;
    }

    public static byte[] SaveUser(HttpListenerContext ctx, in string performer) {
        string payload;
        using (StreamReader reader = new StreamReader(ctx.Request.InputStream, ctx.Request.ContentEncoding))
            payload = reader.ReadToEnd();

        if (payload.Length == 0) return Strings.INV.Array;

        string[] split = payload.Split((char)127);
        if (split.Length < 4) return Strings.INF.Array;

        Hashtable payloadHash = new Hashtable(); //payload as string

        string filename = String.Empty;
        for (int i = 0; i < split.Length - 1; i += 2) {
            split[i] = split[i].ToUpper();
            if (split[i] == ".FILENAME") filename = split[i+1];

            if (payloadHash.ContainsKey(split[i])) //if property exists append on it
                payloadHash[split[i]] = $"{payloadHash[split[i]]}; {split[i+1]}";
            else
                payloadHash.Add(split[i], split[i+1]);
        }

        if (filename.Length == 0) filename = DateTime.Now.Ticks.ToString();

        DbEntry entry;
        bool exists = users.ContainsKey(filename);

        if (exists) { //existing entry
            entry = (DbEntry)users[filename];

        } else {
            entry = new DbEntry() { //new entry
                filename = DateTime.Now.Ticks.ToString(),
                hash = new Hashtable(),
                isUser = true,
                write_lock = new object()
            };

            foreach (DictionaryEntry o in payloadHash)
                entry.hash.Add(o.Key, new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });

            users.Add(filename, entry);
        }

        List<string> removed = new List<string>();
        foreach (DictionaryEntry o in entry.hash) if (!payloadHash.ContainsKey(o.Key)) removed.Add(o.Key.ToString());
        foreach (string o in removed) entry.hash.Remove(o);
        removed.Clear();

        foreach (DictionaryEntry o in payloadHash)
            if (entry.hash.ContainsKey(o.Key)) { //overwrite property
                string key = (string)o.Key;
                string[] current = (string[])entry.hash[key];
                if (key.Contains("PASSWORD")) { //if null, keep old value
                    if (o.Value.ToString().Length > 0) entry.hash[o.Key] = (current[0] == (string)payloadHash[o.Key]) ? current : new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" };
                } else
                    entry.hash[o.Key] = (current[0] == (string)payloadHash[o.Key]) ? current : new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" };
            } else { //new property
                entry.hash.Add(o.Key, new string[] { o.Value.ToString(), $"{performer}, {DateTime.Now.ToString(Strings.DATE_FORMAT)}", "" });
            }
        
        //if hash don't have ".FILENAME" property, create it
        if (!entry.hash.ContainsKey(".FILENAME")) entry.hash.Add(".FILENAME", new string[] { filename, "", "" });

        Write(entry, in performer); //Write() uses its own lock
        usersVer = DateTime.Now.Ticks;
        Logging.Action(in performer, $"{(exists ? "Overwrite" : "Create")} user: {filename}");

        StringBuilder broadcast = new StringBuilder();
        broadcast.Append("{");
        broadcast.Append("\"action\":\"update\",");
        broadcast.Append("\"type\":\"user\",");
        broadcast.Append($"\"target\":\"{filename}\",");
        broadcast.Append($"\"performer\":\"{performer}\",");
        broadcast.Append($"\"version\":\"{usersVer}\",");

        broadcast.Append("\"obj\":{");
        bool fst = true;
        foreach (DictionaryEntry o in entry.hash) {
            if (!fst) broadcast.Append(",");
            string key = (string)o.Key;
            string[] current = (string[])entry.hash[key];
            broadcast.Append($"\"{Strings.EscapeJson(key)}\":");

            if (key.Contains("PASSWORD"))
                broadcast.Append($"[\"\",\"{Strings.EscapeJson(current[1])}\"]");
            else
                broadcast.Append($"[\"{Strings.EscapeJson(current[0])}\",\"{Strings.EscapeJson(current[1])}\"]");

            fst = false;
        }
        broadcast.Append("}");

        broadcast.Append("}");

        byte[] bytes = Encoding.UTF8.GetBytes(broadcast.ToString());
        KeepAlive.Broadcast(bytes);
        return bytes;
    }
    
    public static byte[] DeleteUser(in string[] para, in string performer) {
        string filename;
        if (para.Length > 1)
            filename = para[1];
        else
            return Strings.INV.Array;

        if (users.ContainsKey(filename)) {
            DbEntry entry = (DbEntry)users[filename];
            lock (entry.write_lock) {
                try {
                    string fullpath = $"{Strings.DIR_USERS}_del";
                    DirectoryInfo dir = new DirectoryInfo(fullpath);
                    if (!dir.Exists) dir.Create();

                    File.Move($"{Strings.DIR_USERS}\\{filename}", $"{fullpath}\\{filename}");
                    users.Remove(filename);

                } catch (Exception ex) {
                    Logging.Err(ex);
                }
            }

            Logging.Action(in performer, $"Delete user: {filename}");

            usersVer = DateTime.Now.Ticks;

            StringBuilder broadcast = new StringBuilder();
            broadcast.Append("{");
            broadcast.Append("\"action\":\"delete\",");
            broadcast.Append("\"type\":\"user\",");
            broadcast.Append($"\"target\":\"{filename}\",");
            broadcast.Append($"\"performer\":\"{performer}\",");
            broadcast.Append($"\"version\":\"{usersVer}\"");
            broadcast.Append("}");

            byte[] bytes = Encoding.UTF8.GetBytes(broadcast.ToString());
            KeepAlive.Broadcast(bytes);

            return Strings.OK.Array;
        } else
            return Strings.FLE.Array;
    }

}