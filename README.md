  
# Source Engine Map Viewer  
  
View Source engine maps in your browser.  
Simply drag and drop the game folder into the browser to view any map.  
  
Currently only Team Fortress 2 is supported as it's the only game I've tested with.  
But adding Half-Life 2, Left 4 Dead 2, & Portal 2 should be pretty easy.  
  
I do not plan to attept to optimize this, If it's slow for you oh well. . .  
  
# Story  
  
I originally had a plan to make a map viewer for all sorts of games  
(Source engine maps, Minecraft worlds, Unity models, TrackMania tracks)  
But that project quickly got wayyyy too big so I decided to just make them in their own seperate projects.  
  
This was originally made in JavaScript  
but I've decided to convert it to TypeScript  
because working with all the different types was horrible.  
  
# TODO  
  
* Interface  
    * Add map selection UI  
        * (Currently automatically selects pl_upward.bsp)  
    * Flight controller instead of orbit controller.  
* Renderer  
    * Animated textures  
    * Materials  
        * Implement water shader.  
    * Lighting  
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
  