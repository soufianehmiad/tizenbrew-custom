> **This is a personal fork of [reisxd/TizenBrew](https://github.com/reisxd/TizenBrew) (v2.0.5), GPL-3.0.**
> It is not the official TizenBrew; use the original unless you want these changes:
> - New interface: app logos instead of a list, Apple TV style selection, flat Samsung-style settings.
> - Fixes: "open app at start" (upstream issue #151), several service crashes, retries after a failed download,
>   a TV that refuses the Developer Mode check for a while after a restart, errors shown with their real reason.
> - `fixes/`: small fixes for apps, loaded by this TizenBrew right after the app (e.g. `fixes/@foxreis/tizentube.js`
>   replaces missing HD thumbnails). They are fetched at each launch, so they update without reinstalling.
> - Build, tests and install scripts: `custom/` (signing uses your own Tizen certificate profile).
>
> Releases of this fork can be installed with the official
> [TizenBrew Installer](https://github.com/reisxd/TizenBrewInstaller) (GitHub option, `soufianehmiad/tizenbrew-custom`).

# 🍺 TizenBrew

<p align="center">
    <img width="700px" src="./.github/assets/TizenBrew_Official_Banner.png">
    <br>
    <sub> TizenBrew logo, banner and README by <a href="https://github.com/Zyborg777">@Zyborg777</a> </sub>
</p>

### Experience your favorite custom apps (such as [TizenTube](https://github.com/reisxd/TizenTube)) in a whole new way!
Thanks to TizenBrew, you can install newer apps without having to deal with Tizen Studio multiple times. Just one click
and you're done 🎊

<p align="center">
    <a href="https://discord.gg/m2P7v8Y2qR">
        <picture>
            <source height="24px" media="(prefers-color-scheme: dark)"
                srcset="https://user-images.githubusercontent.com/13122796/178032563-d4e084b7-244e-4358-af50-26bde6dd4996.png" />
            <img height="24px"
                src="https://user-images.githubusercontent.com/13122796/178032563-d4e084b7-244e-4358-af50-26bde6dd4996.png" />
        </picture>
    </a>&nbsp;&nbsp;&nbsp;
    <a href="https://t.me/tizenbrew">
        <picture>
            <source height="24px" media="(prefers-color-scheme: dark)"
                srcset="https://user-images.githubusercontent.com/13122796/178032213-faf25ab8-0bc3-4a94-a730-b524c96df124.png" />
            <img height="24px"
                src="https://user-images.githubusercontent.com/13122796/178032213-faf25ab8-0bc3-4a94-a730-b524c96df124.png" />
        </picture>
    </a>&nbsp;&nbsp;&nbsp;
    <a href="https://reddit.com/r/TizenTube">
        <picture>
            <source height="24px" media="(prefers-color-scheme: dark)"
                srcset="https://user-images.githubusercontent.com/13122796/178032351-9d9d5619-8ef7-470a-9eec-2744ece54553.png" />
            <img height="24px"
                src="https://user-images.githubusercontent.com/13122796/178032351-9d9d5619-8ef7-470a-9eec-2744ece54553.png" />
        </picture>
    </a>&nbsp;&nbsp;&nbsp;
    <a href="https://www.youtube.com/@tizenbrew">
        <picture>
            <source height="24px" media="(prefers-color-scheme: dark)"
                srcset="https://user-images.githubusercontent.com/13122796/178032714-c51c7492-0666-44ac-99c2-f003a695ab50.png" />
            <img height="24px"
                src="https://user-images.githubusercontent.com/13122796/178032714-c51c7492-0666-44ac-99c2-f003a695ab50.png" />
        </picture>
    </a>
</p>


# 🙌 Getting started

### You can read the [guide](./docs/README.md) down below to get started with TizenBrew ⬇️
<p align="left">
    <a href="./docs/README.md">
        <picture>
            <source height="50px" srcset="./.github/assets/TizenBrew_Guide_Button.png" />
            <img height="50px" src="./.github/assets/TizenBrew_Guide_Button.png" />
        </picture>
    </a>
</p>

# 💻 Making a module

You can read the [guide](./docs/MODULES.md) to make a module for TizenBrew.

# 💬 Translations

You can read the [guide](./docs/TRANSLATION.md) to translate TizenBrew into your native language.