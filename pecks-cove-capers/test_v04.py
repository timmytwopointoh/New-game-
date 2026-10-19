from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path(__file__).parent
html=(p/'web/index.html').read_text().replace('<script src="game.js"></script>','<script>'+(p/'web/game.js').read_text()+'</script>')
with sync_playwright() as pl:
 browser=pl.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for name,viewport in [('landscape',{'width':1024,'height':590}),('portrait',{'width':393,'height':852})]:
  page=browser.new_page(viewport=viewport,has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.locator('#play').click()
  page.wait_for_timeout(220)
  assert page.evaluate('getComputedStyle(document.querySelector("#dpad button")).userSelect')=='none'
  button=page.locator('#dpad button[data-dir=right]')
  bounds=button.bounding_box();cx=bounds['x']+bounds['width']/2;cy=bounds['y']+bounds['height']/2
  cdp=page.context.new_cdp_session(page)
  start=page.evaluate('window.__coveTest.game.x')
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy,'id':1}]})
  page.wait_for_timeout(360)
  stop=page.evaluate('window.__coveTest.game.x')
  assert stop>start+15,(start,stop)
  button=page.locator('#dpad button[data-dir=right]')
  assert button.evaluate('(el)=>{let event=new MouseEvent("contextmenu",{bubbles:true,cancelable:true});return !el.dispatchEvent(event)}')
  assert button.evaluate('(el)=>{let event=new Event("selectstart",{bubbles:true,cancelable:true});return !el.dispatchEvent(event)}')
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  pause=page.evaluate('window.__coveTest.game.x');page.wait_for_timeout(140)
  assert abs(page.evaluate('window.__coveTest.game.x')-pause)<2
  page.evaluate('window.__coveTest.game.x=568;window.__coveTest.game.y=304')
  page.keyboard.down('ArrowRight');page.wait_for_timeout(850);page.keyboard.up('ArrowRight')
  location=page.evaluate('({x:window.__coveTest.game.x,y:window.__coveTest.game.y})')
  assert location['x']<584,location # stops at expanded table collision edge
  assert page.evaluate('window.__coveTest.canStand(window.__coveTest.game.x,window.__coveTest.game.y)')
  page.evaluate('let g=window.__coveTest.goal();window.__coveTest.game.x=g[2];window.__coveTest.game.y=g[3];window.__coveTest.completeTask({kind:"job",x:g[2],y:g[3],label:g[0],icon:g[4]})')
  assert page.evaluate('window.__coveTest.game.completedStations.length')==1
  assert page.evaluate('window.__coveTest.game.jobVisuals.dishes')==1
  page.wait_for_timeout(90)
  page.screenshot(path=str(p/f'v04-{name}-game.png'))
  assert not errors,errors
  page.close()
 print('PASS: v0.4 both layouts; no long-press selection; held movement; solid table collision; role-specific work results; no JS errors')
 browser.close()
