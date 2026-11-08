namespace MedStockPro.Api.Services
{
    /// <summary>
    /// Normalises product photo references to the single canonical form the
    /// static file server and frontend expect:  /uploads/products/&lt;file&gt;
    ///
    /// Handles every legacy shape found in the database:
    ///   C:\...\Pic Med\abc.jpg        -> /uploads/products/abc.jpg
    ///   Uploads\products\abc.jpg      -> /uploads/products/abc.jpg
    ///   products\abc.jpg              -> /uploads/products/abc.jpg
    ///   abc.jpg                       -> /uploads/products/abc.jpg
    ///   /uploads/products/abc.jpg     -> /uploads/products/abc.jpg (unchanged)
    ///   http://host/uploads/products/abc.jpg -> /uploads/products/abc.jpg
    /// Empty/whitespace stays empty.
    /// </summary>
    public static class PhotoPaths
    {
        public const string PublicPrefix = "/uploads/products/";

        /// <summary>Return the canonical /uploads/products/&lt;file&gt; path.</summary>
        public static string Normalize(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

            var value = raw.Trim();

            // Strip any query string / fragment defensively.
            var cut = value.IndexOfAny(new[] { '?', '#' });
            if (cut >= 0) value = value.Substring(0, cut);

            // Keep only the final path segment (handles both / and \ separators
            // and full Windows or URL paths).
            var slash = value.LastIndexOfAny(new[] { '/', '\\' });
            var fileName = slash >= 0 ? value.Substring(slash + 1) : value;

            if (string.IsNullOrWhiteSpace(fileName)) return string.Empty;

            return PublicPrefix + fileName;
        }

        /// <summary>Absolute URL for a photo, or "" when there is no photo.</summary>
        public static string ToUrl(string? raw, HttpRequest request)
        {
            var normalized = Normalize(raw);
            if (string.IsNullOrEmpty(normalized)) return string.Empty;
            return $"{request.Scheme}://{request.Host}{normalized}";
        }
    }
}
