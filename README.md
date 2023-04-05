  
# Source Engine Map Viewer  
  
View Source engine maps in your browser.  
Simply drag and drop the game folder into the browser to view any map.  
  
![Source Engine Map Viewer](./resources/Screenshot%202023-04-04%20165938.png "Source Engine Map Viewer")  
  
Currently only Team Fortress 2 is supported as it's the only game I've tested with.  
But adding Half-Life 2, Left 4 Dead 2, Portal 2, & Garry's Mod should be pretty easy.  
  
![Source Engine Shadow](./resources/Screenshot%202023-04-04%20165917.png "Source Engine Shadow")  
  
I do not plan to attept to optimize this, If it's slow for you oh well. . .  
  
# Story  
  
I originally had a plan to make a map viewer for all sorts of games  
(Source engine maps, Minecraft worlds, Unity models, TrackMania tracks)  
But that project quickly got wayyyy too big so I decided to just make them in their own seperate projects.  
  
This was originally made in JavaScript  
but I've decided to convert it to TypeScript  
because working with all the different types was horrible.  
  
# Usage  
  
Until I figure out how to make a GitHub page you'll need to host it locally.  
1. Clone the repository  
2. Install dependencies `npm install`  
3. Run dev `npm run start`  
4. Change map path at the start of [src/index.ts](src/index.ts)
  
# TODO  
  
* Figure out how to make this GitHub page.  
* Interface  
    * Add map selection UI  
        * (Currently automatically selects pl_upward.bsp)  
    * Flight controller instead of orbit controller.  
* Renderer  
    * Animated textures  
    * Materials  
        * Implement water shader.  
    * Lighting  
        * Lightmap merging is slightly off. (UV's are messed up.)  
        * Displacement lighting is wrong.  
        * No ambient light.  
        * Lights are too bright.  
    * BSP tree  
        * (Use BSP tree rendering instead of rendering the whole map.)  
    * Skybox  
        * 2D cubemap skybox.  
        * 3D skybox camera.  
            * (For 3D skybox to work bsp tree rendering is required.)  
    * Models  
    * Animations  
    * Entity system  
  
# DISCLAIMER  
<pre>
This project and its creator are not affiliated with Valve Corporation
</pre>  
  