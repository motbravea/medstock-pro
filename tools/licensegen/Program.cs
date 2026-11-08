using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

// ─────────────────────────────────────────────────────────────────────────
//  MedStock Pro — offline licence key generator (DEVELOPER TOOL ONLY).
//
//  This tool is NEVER shipped to the clinic. It holds / uses the PRIVATE
//  signing key. The application only ever holds the matching PUBLIC key.
//
//  Commands:
//    keygen
//        Generate a fresh ECDSA P-256 key pair. Prints:
//          PUBLIC KEY  → paste into appsettings.json  "License:PublicKey"
//          PRIVATE KEY → store securely, NEVER commit, NEVER ship
//
//    issue --clinic "Clinic Name" --devices 1 [--expires 2027-12-31]
//          --private <base64 private key>
//        Produce a licence key to give to that clinic.
//
//  A licence key is:  base64url(payloadJson) + "." + base64url(signature)
//  signed with ECDSA-P256 / SHA-256 over the payload bytes.
// ─────────────────────────────────────────────────────────────────────────

if (args.Length == 0)
{
    PrintUsage();
    return 1;
}

switch (args[0].ToLowerInvariant())
{
    case "keygen":
        return KeyGen();
    case "issue":
        return Issue(args);
    default:
        PrintUsage();
        return 1;
}

static int KeyGen()
{
    using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    var priv = Convert.ToBase64String(ecdsa.ExportPkcs8PrivateKey());
    var pub = Convert.ToBase64String(ecdsa.ExportSubjectPublicKeyInfo());

    Console.WriteLine("=== MedStock Pro licence key pair ===");
    Console.WriteLine();
    Console.WriteLine("PUBLIC KEY (paste into appsettings.json → License:PublicKey):");
    Console.WriteLine(pub);
    Console.WriteLine();
    Console.WriteLine("PRIVATE KEY (store securely — NEVER commit or ship):");
    Console.WriteLine(priv);
    Console.WriteLine();
    Console.WriteLine("Keep the private key to issue licence keys with:  licensegen issue ...");
    return 0;
}

static int Issue(string[] args)
{
    string? clinic = null;
    int devices = 1;
    string? expires = null;
    string? privateKey = null;

    for (var i = 1; i < args.Length - 1; i++)
    {
        switch (args[i].ToLowerInvariant())
        {
            case "--clinic": clinic = args[++i]; break;
            case "--devices": devices = int.TryParse(args[++i], out var d) ? d : 1; break;
            case "--expires": expires = args[++i]; break;
            case "--private": privateKey = args[++i]; break;
        }
    }

    if (string.IsNullOrWhiteSpace(clinic))
    {
        Console.Error.WriteLine("error: --clinic is required.");
        return 1;
    }
    if (string.IsNullOrWhiteSpace(privateKey))
    {
        Console.Error.WriteLine("error: --private <base64 private key> is required.");
        return 1;
    }

    DateTime? expiresDate = null;
    if (!string.IsNullOrWhiteSpace(expires))
    {
        if (!DateTime.TryParse(expires, out var parsed))
        {
            Console.Error.WriteLine("error: --expires must be a date like 2027-12-31.");
            return 1;
        }
        expiresDate = parsed.Date;
    }

    var payload = new
    {
        clinic = clinic.Trim(),
        maxDevices = devices < 1 ? 1 : devices,
        issued = DateTime.Today.ToString("yyyy-MM-dd"),
        expires = expiresDate?.ToString("yyyy-MM-dd"),
    };

    var payloadJson = JsonSerializer.Serialize(payload);
    var payloadBytes = Encoding.UTF8.GetBytes(payloadJson);

    byte[] signature;
    try
    {
        using var ecdsa = ECDsa.Create();
        ecdsa.ImportPkcs8PrivateKey(Convert.FromBase64String(privateKey), out _);
        signature = ecdsa.SignData(payloadBytes, HashAlgorithmName.SHA256);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"error: could not sign with the provided private key: {ex.Message}");
        return 1;
    }

    var key = Base64Url(payloadBytes) + "." + Base64Url(signature);

    Console.WriteLine("=== Licence key issued ===");
    Console.WriteLine($"Clinic   : {payload.clinic}");
    Console.WriteLine($"Devices  : {payload.maxDevices}");
    Console.WriteLine($"Expires  : {payload.expires ?? "never"}");
    Console.WriteLine();
    Console.WriteLine("LICENCE KEY (give this to the clinic):");
    Console.WriteLine(key);
    return 0;
}

static string Base64Url(byte[] bytes)
    => Convert.ToBase64String(bytes)
        .TrimEnd('=')
        .Replace('+', '-')
        .Replace('/', '_');

static void PrintUsage()
{
    Console.WriteLine("MedStock Pro licence generator (developer tool)");
    Console.WriteLine();
    Console.WriteLine("Usage:");
    Console.WriteLine("  licensegen keygen");
    Console.WriteLine("  licensegen issue --clinic \"Clinic Name\" --devices 1 [--expires 2027-12-31] --private <base64 private key>");
}
