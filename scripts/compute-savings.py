import json, os

with open('public/real-data/citiesList.json') as f:
    cities_data = json.load(f)['cities']

with open('public/real-data/citiesPopulation.json') as f:
    pop_data = json.load(f)

merged = {}
for name, info in cities_data.items():
    entry = {'id': info['id'], 'lat': info['lat'], 'lng': info['lng']}
    if 'he' in info:
        entry['he'] = info['he']
    if 'en' in info:
        entry['en'] = info['en']
    pop = pop_data.get(str(info['id']))
    if pop:
        entry['pop'] = pop
    merged[name] = entry

merged_json = json.dumps({'cities': merged}, ensure_ascii=False, separators=(',', ':'))

# Write the merged output file
with open('public/real-data/citiesData.json', 'w', encoding='utf-8') as f:
    f.write(merged_json)
print("Written: public/real-data/citiesData.json")

orig_cities = os.path.getsize('public/real-data/citiesList.json')
orig_pop    = os.path.getsize('public/real-data/citiesPopulation.json')
orig_poly   = os.path.getsize('public/real-data/polygonsList.json')
merged_size = len(merged_json.encode('utf-8'))

print(f"Original citiesList.json   : {orig_cities:>9,} bytes ({orig_cities/1024:.1f} KB)")
print(f"Original citiesPopulation  : {orig_pop:>9,} bytes ({orig_pop/1024:.1f} KB)")
print(f"Original polygonsList.json : {orig_poly:>9,} bytes ({orig_poly/1024:.1f} KB)")
print(f"---")
print(f"Merged citiesData.json     : {merged_size:>9,} bytes ({merged_size/1024:.1f} KB)")
print(f"Polygons dropped           : {orig_poly:>9,} bytes ({orig_poly/1024:.1f} KB)")
print()
orig_total = orig_cities + orig_pop + orig_poly
new_total  = merged_size
saved = orig_total - new_total
print(f"Total BEFORE (3 files)     : {orig_total:>9,} bytes ({orig_total/1024:.1f} KB)")
print(f"Total AFTER  (1 file)      : {new_total:>9,} bytes ({new_total/1024:.1f} KB)")
print(f"Saved                      : {saved:>9,} bytes ({saved/1024:.1f} KB) = {saved/orig_total*100:.0f}% reduction")
