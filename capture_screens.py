import sys
import os
import asyncio
import base64
import json
import matplotlib.pyplot as plt
import numpy as np

# 1. Generate ThingSpeak dummy chart
def generate_thingspeak_chart():
    print("Generating ThingSpeak chart...")
    # Create an image that looks like a ThingSpeak chart
    np.random.seed(42)
    time_series = np.arange(0, 100)
    temp_data = 5 + np.sin(time_series / 10.0) * 3 + np.random.normal(0, 0.5, 100)
    
    fig, ax = plt.subplots(figsize=(8, 4), facecolor='#ffffff')
    ax.plot(time_series, temp_data, color='#1f77b4', linewidth=1.5)
    ax.set_title('Field 1 Chart\nTemperature', loc='center', color='#333333', pad=10, fontsize=12)
    ax.grid(True, linestyle='-', alpha=0.3, color='#cccccc')
    ax.set_facecolor('#ffffff')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#dddddd')
    ax.spines['bottom'].set_color('#dddddd')
    ax.tick_params(axis='x', colors='#666666')
    ax.tick_params(axis='y', colors='#666666')
    
    # ThingSpeak logo text placeholder
    plt.text(0.95, 0.05, 'ThingSpeak.com', transform=ax.transAxes, 
             fontsize=9, color='#888888', alpha=0.5, ha='right', va='bottom')
    
    plt.tight_layout()
    plt.savefig('images/thingspeak.png', dpi=150, bbox_inches='tight')
    plt.close()

# 2. Use Playwright for remaining screenshots
async def capture_browser_screens():
    from playwright.async_api import async_playwright
    
    with open('firmware/diagram.json', 'r') as f:
        diagram_json = f.read()
    with open('firmware/sketch.ino', 'r') as f:
        sketch_code = f.read()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # --- Dashboard Screenshot ---
        try:
            print("Capturing local Dashboard...")
            page_dash = await browser.new_page()
            abs_path = os.path.abspath('dashboard/index.html')
            await page_dash.goto(f'file://{abs_path}')
            # Give UI time to render animation
            await page_dash.wait_for_timeout(2000)
            await page_dash.screenshot(path='images/dashboard.png')
        except Exception as e:
            print(f"Failed dashboard: {e}")
        
        # --- Wokwi Screenshot ---
        try:
            print("Capturing Wokwi Simulation...")
            # We will construct a share link or inject via JS. Wokwi can be tricky.
            # Easiest way without auth is to navigate, wait for monaco, and inject.
            page = await browser.new_page()
            await page.goto("https://wokwi.com/projects/new/esp32", wait_until="networkidle")
            
            # Wait for editor to be ready
            await page.wait_for_selector('.part-esp32', timeout=15000)
            
            # Inject code directly into monaco models
            js_code = f"""
            () => {{
                // Try to find the monaco instance and models
                const models = window.monaco ? window.monaco.editor.getModels() : [];
                for(let m of models) {{
                    if(m.uri.path.includes('sketch.ino')) {{
                        m.setValue({json.dumps(sketch_code)});
                    }}
                    if(m.uri.path.includes('diagram.json')) {{
                        m.setValue({json.dumps(diagram_json)});
                    }}
                }}
            }}
            """
            await page.evaluate(js_code)
            
            # Wait a moment for diagram to re-render after JSON injection
            await page.wait_for_timeout(3000)
            
            # Screenshot the whole page
            await page.screenshot(path='images/wokwi.png')
            
        except Exception as e:
            print(f"Failed Wokwi: {e}")
            
        await browser.close()

if __name__ == "__main__":
    generate_thingspeak_chart()
    asyncio.run(capture_browser_screens())
