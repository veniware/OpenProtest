﻿using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;

public static class Backup {

    public static byte[] Get() {
        DirectoryInfo dir = new DirectoryInfo(Strings.DIR_BACKUP);
        if (!dir.Exists) return Strings.FLE.Array;

        FileInfo[] files = dir.GetFiles();

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < files.Length; i++) {
            sb.Append($"{files[i].Name}{(char)127}");
            sb.Append($"{files[i].CreationTime.ToString(Strings.DATETIME_FORMAT)}{(char)127}");
            sb.Append($"{Strings.SizeToString(files[i].Length)}{(char)127}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public static byte[] Create(in string[] para, in string performer) {
        string name = String.Empty;
        for (int i = 1; i < para.Length; i++)
            if (para[i].StartsWith("name=")) name = Strings.DecodeUrl(para[i].Substring(5));

        foreach (char c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');

        string filename = $"{Strings.DIR_BACKUP}\\{name}.zip";
        int count = 1;

        while (File.Exists(filename))
            filename = $"{Strings.DIR_BACKUP}\\{name}_{++count}.zip";

        try {
            DirectoryInfo dirBackup = new DirectoryInfo(Strings.DIR_BACKUP);
            if (!dirBackup.Exists) dirBackup.Create();

            DirectoryInfo dirCopy = new DirectoryInfo($"{filename}.tmp");
            if (dirCopy.Exists) dirCopy.Delete();
            dirCopy.Create();

            DirectoryInfo dirData = new DirectoryInfo($"{Strings.DIR_DATA}");
            if (dirData.Exists) CopyAll(dirData, new DirectoryInfo($"{dirCopy.FullName}\\{dirData.Name}"));

            DirectoryInfo dirLog = new DirectoryInfo($"{Strings.DIR_LOG}");
            if (dirLog.Exists) CopyAll(dirLog ,new DirectoryInfo($"{dirCopy.FullName}\\{dirLog.Name}"));

            DirectoryInfo dirAcl = new DirectoryInfo($"{Strings.DIR_ACL}");
            if (dirAcl.Exists) CopyAll(dirAcl, new DirectoryInfo($"{dirCopy.FullName}\\{dirAcl.Name}"));


            ZipFile.CreateFromDirectory(dirCopy.FullName, filename);
            dirCopy.Delete(true);

        } catch { }

        Logging.Action(performer, $"Create backup: {name}{(count == 1 ? String.Empty : $"_{count}")}.zip");

        return Strings.OK.Array;
    }

    private static void CopyAll(DirectoryInfo  source, DirectoryInfo destination) {
        if (!destination.Exists) destination.Create();

        FileInfo[] files = source.GetFiles();
        for (int i = 0; i < files.Length; i++)
            files[i].CopyTo($"{destination.FullName}\\{files[i].Name}");
               
        DirectoryInfo[] subfolders = source.GetDirectories();
        for (int i = 0; i < subfolders.Length; i++)
            CopyAll(subfolders[i], new DirectoryInfo(subfolders[i].FullName.Replace(source.FullName, destination.FullName)));
    }

    public static byte[] Delete(in string[] para, in string performer) {
        string name = String.Empty;
        for (int i = 1; i < para.Length; i++)
            if (para[i].StartsWith("name=")) name = Strings.DecodeUrl(para[i].Substring(5));

        try {
            FileInfo file = new FileInfo($"{Strings.DIR_BACKUP}\\{name}");
            if (file.Exists) file.Delete();
            Logging.Action(performer, $"Delete backup: {name}");
        } catch {
            return Strings.FAI.Array;
        }

        return Strings.OK.Array;
    }

}
