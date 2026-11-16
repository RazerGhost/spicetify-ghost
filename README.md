# Ghost (built theme)

This is the built [Ghost](https://github.com/RazerGhost/spicetify-ghost) Spicetify
theme, published automatically from `main`. Source, issues and docs live on the
[main branch](https://github.com/RazerGhost/spicetify-ghost).

## Install by hand

1. Download this branch as a ZIP:
   <https://github.com/RazerGhost/spicetify-ghost/archive/refs/heads/dist.zip>
2. Extract it into Spicetify's `Themes` folder (`spicetify path userdata` shows where
   that is) and rename the extracted folder to `Ghost`.
3. Apply it:

   ```sh
   spicetify config inject_css 1 replace_colors 1 overwrite_assets 1 inject_theme_js 1
   spicetify config current_theme Ghost color_scheme dark
   spicetify apply
   ```

Colour schemes: `dark`, `oled`. A hand install doesn't update itself; repeat the steps
to update, or use the Marketplace or the install scripts instead.
