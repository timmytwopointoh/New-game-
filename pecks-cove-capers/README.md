# Pek's Plunder — v0.9 restaurant floorplan overhaul

Offline, independently-created arcade-style restaurant game inspired by the user's description of Pek's Old Port Cove. Not an officially endorsed product.

## Floorplan
- Chowder room is **directly above the central kitchen**, and the dish pit (dishwasher + three sinks) runs along the kitchen's **top/north edge**.
- One pressure-operated door from the kitchen into the chowder room lies **immediately to the right of the dish pit**.
- The bar is left of the central kitchen, and the order pickup window lies between the bar and kitchen.
- The tiki area is beyond the chowder room, with raised north/west walkways, open water on the north side, a pier extending into the water at the northwest, and dry land and parking elsewhere.
- The employee hallway runs along the right of the kitchen and includes a customer-area door, an employee entrance, and open connections to prep, walk-in refrigerator and its north freezer. No door objects on cold-storage doorways.
- Public entrance is far left.

## Systems
- Six task types per base role; all minigames have five variants.
- Ten base roles and four fictional locked spotlight slots, with consistent job-family uniforms, stat bars and special perks.
- Moving and traversing doors consumes shift time; the staff member enters after the sunrise animation.
- Guest patience is about 60 seconds, affected by Charm; abandoning an order costs 2 coins.
- Tiny coin values (normally 2–3) and unlock costs of 50/100/150/200; earned day coins stored offline using the v0.8 profile key to preserve prior unlocked data.
- Pressure doors open automatically on character approach and close after passing.

Browser test `node test_logic.cjs`. Local browser preview: `web/standalone.html`. Build in Android folder with Gradle 8.9, Android SDK 35.
