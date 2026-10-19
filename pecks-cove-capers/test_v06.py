from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':720},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content((root/'web/standalone.html').read_text(),wait_until='domcontentloaded')
 page.wait_for_timeout(4300)
 assert page.locator('#sunriseIntro').evaluate('(el)=>el.classList.contains("introFade")'), 'intro must fade out'
 assert page.locator('.logo').inner_text().startswith("PEK'S PLUNDER")
 page.screenshot(path=str(root/'menu.png'))
 page.locator('#play').click()
 page.wait_for_timeout(700)
 assert page.locator('#gameScreen').is_visible(), 'game active'
 page.screenshot(path=str(root/'game.png'))
 assert page.evaluate('window.__coveTest.SHIFT_LENGTH')==720
 page.locator('#taskBtn').click()
 assert page.locator('#taskBoard').is_visible()
 assert 'Job tasks' in page.locator('#taskItems').inner_text()
 page.locator('#closeBoard').click()
 # dish minigame
 page.evaluate('''()=>{let t=window.__coveTest.game;let goal=window.__coveTest.target();t.done=1;t.x=goal.x;t.y=goal.y;let a=window.__coveTest.target();t.x=a.x;t.y=a.y;}''')
 page.locator('#action').dispatch_event('pointerdown',{'pointerId':1,'pointerType':'touch','clientX':1150,'clientY':650})
 page.wait_for_timeout(350)
 assert page.locator('#minigameOverlay').is_visible(), 'dish minigame opened'
 page.screenshot(path=str(root/'dish.png'))
 # Simulate genuine taps plus swipes on all dirty patches. Check automatic completion.
 page.evaluate('''()=>{const h=window.__coveTest;for(const d of [...h.mini.grime])for(let j=0;j<7&&h.mini;j++)h.applyMini(d.x,d.y,true)}''')
 assert not page.locator('#minigameOverlay').is_visible(), 'dish requires scrubbing and completes'
 assert page.evaluate('window.__coveTest.game.done')==2, 'dish task counted'

 page.evaluate('''()=>{window.__coveTest.choose(1);window.__coveTest.begin();let t=window.__coveTest.game;t.done=1;let a=window.__coveTest.target();t.x=a.x;t.y=a.y;window.__coveTest.pressWork()}''')
 assert page.locator('#minigameTitle').inner_text().endswith('CLEAN THE FRYER'), 'fryer accessible'
 old=page.evaluate('window.__coveTest.game.elapsed')
 page.evaluate('window.__coveTest.update(5)')
 assert page.evaluate('window.__coveTest.game.elapsed')==old,'shift clock pauses during mini'
 page.evaluate('''()=>{const h=window.__coveTest;for(let i=0;i<25&&h.mini;i++){h.applyMini(i%2?350:110,145)}}''')
 assert not page.locator('#minigameOverlay').is_visible(), 'fryer completes after repeated reversals'
 assert page.evaluate('window.__coveTest.game.done')==2, 'fryer task counted'
 page.evaluate('window.__coveTest.game.elapsed=280;window.__coveTest.update(0.05)')
 assert page.locator('#dayLabel').inner_text()=='LUNCH RUSH'
 page.evaluate('window.__coveTest.game.elapsed=520;window.__coveTest.update(0.05)')
 assert page.locator('#dayLabel').inner_text()=='SUNSET RUSH'
 page.evaluate('window.__coveTest.game.elapsed=719.99;window.__coveTest.update(0.05)')
 assert page.evaluate('window.__coveTest.state')=='finish', 'shift ends after 12m active play'
 page.screenshot(path=str(root/'fryer.png'))
 assert not errors,errors
 print('PASS UI intro/menu/main game/shift HUD/checklist/dish/fryer. Screenshots saved.')
 browser.close()
