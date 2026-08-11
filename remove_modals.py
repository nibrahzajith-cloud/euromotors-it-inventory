import re

with open('src/pages/AssetProfile.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# The modal starts at "      {/* Delete Image Confirmation */}" and ends right before "    </div>\n  );\n}" at the end of the file.

start_str = '      {/* Delete Image Confirmation */}'
end_str = '    </div>\n  );\n}\n'
start_idx = text.find(start_str)
end_idx = text.rfind(end_str)

if start_idx != -1 and end_idx != -1:
    text = text[:start_idx] + text[end_idx:]

with open('src/pages/AssetProfile.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Modals removed successfully.")
