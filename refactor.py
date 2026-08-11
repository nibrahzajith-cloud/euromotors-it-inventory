import re

with open('src/pages/AssetProfile.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
text = text.replace(
    'Pencil, Save, X, Upload, Trash2, FileText, Image as ImageIcon, ExternalLink, Camera',
    'Pencil, Save, X'
)
text = text.replace(
    'import imageCompression from \'browser-image-compression\';\nimport { PDFDocument } from \'pdf-lib\';',
    'import AssetImage from \'../components/AssetMedia/AssetImage\';\nimport AssetDocuments from \'../components/AssetMedia/AssetDocuments\';'
)

# 2. State & fetchAssetProfile
stateStart = text.find('  // Upload state')
stateEnd = text.find('  const startEditing = () => {')
fetchText = '''  const fetchAssetProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`\${API_URL}/assets/code/\${encodeURIComponent(assetCode)}`, {
        headers: { 'Authorization': `Bearer \${token}` }
      });
      
      if (!res.ok) {
         if (res.status === 404) throw new Error("Asset Code not found in database.");
         throw new Error("Failed fetching asset logic bounds.");
      }
      
      const data = await res.json();
      setAsset(data);

      // Fetch Timeline
      const timelineRes = await fetch(`\${API_URL}/assets/\${data.id}/timeline`, { headers: { 'Authorization': `Bearer \${token}` } });
      if (timelineRes.ok) setTimeline(await timelineRes.json());

      // Fetch locations & departments for dropdowns
      const [locRes, deptRes] = await Promise.all([
        fetch(`\${API_URL}/locations`, { headers: { 'Authorization': `Bearer \${token}` } }),
        fetch(`\${API_URL}/departments`, { headers: { 'Authorization': `Bearer \${token}` } })
      ]);
      if (locRes.ok) setLocations(await locRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetProfile();
  }, [assetCode]);

'''
if stateStart != -1 and stateEnd != -1:
    text = text[:stateStart] + fetchText + text[stateEnd:]

# 3. Methods
methodsStart = text.find('  const handleForceDownload = async (url, filename) => {')
methodsEnd = text.find('  // Reusable edit field renderer')
if methodsStart != -1 and methodsEnd != -1:
    text = text[:methodsStart] + text[methodsEnd:]

# 4. Inline HTML
htmlStart = text.find('              {/* Asset Image Card */}')
htmlEnd = text.find('            </div>\n          </div>\n        ) : (\n          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl mx-auto w-full">')
componentsText = '''              {/* Asset Image Card */}
              <AssetImage asset={asset} onUpdate={fetchAssetProfile} />

              {/* Asset Documents Card */}
              <AssetDocuments asset={asset} onUpdate={fetchAssetProfile} />
'''
if htmlStart != -1 and htmlEnd != -1:
    text = text[:htmlStart] + componentsText + text[htmlEnd:]

# 5. Modals
modalStart = text.find('      {/* Camera Capture Modal */}')
modalEnd = text.find('    </>\n  );\n}\n\nfunction AssetTimeline({ timeline }) {\n')
if modalStart != -1 and modalEnd != -1:
    text = text[:modalStart] + text[modalEnd:]

with open('src/pages/AssetProfile.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Refactored using Python successfully')
