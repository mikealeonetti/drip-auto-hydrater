# DRIP hydrater
This script is meant to be a automated way to trigger some automatic actions to truly make things set-it-and-forget it.

It currently supports
- The DRIP Faucet
- The DRIP Farm
- Furio
- ArkFi
- Trunk/Stampede

## Script set up
You'll need to create a **config/local.json** file for this to work. Here is a sample one:
```json
{
        "debug" : false,
        "crypt" : {
                "key" : "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
        },
        "telegram" : {
                "botToken" : "XXXXXXXXXX:XXXXXXXXX-XXXXXXX-XXXXXXXXXXX-XXXXX"
        },
        "accounts" : [
        {
                "key" : "main",
                "driver" : "faucet",
                "id" : "0x24a9DBE26b537c666D71A2c8aA9B9633462F85Cc",
                "actions" : [ "claim", "hydrate", "claim", "hydrate", "claim", "hydrate", "hydrate" ],
                "enabled" : true
        },
        {
                "key" : "main-garden",
                "keyFile" : "main",
                "driver" : "garden",
                "id" : "0x24a9DBE26b537c666D71A2c8aA9B9633462F85Cc",
                "actions" : [ "claim", "plant", "plant", "plant", "plant" ],
                "enabled" : true
        },
        ],
        "schedule" : {
                "times" : "12"
        }
}
```
* **debug** - Turn on debugging mode.
* **crypt.key** - 32 bytes of random data for the key. Easily generate it with the *openssl rand -base64 32* command on Linux. Copy and paste the whole thing. Requires it to be base64 encrypted.
* **telegram.botToken** - Optional Telegram bot token. Speak to the @botfather on telegram to create a bot and get a token. More on that later.
* **accounts** - Array of different accounts. More on this below. These are automatically created for you with the *bin/add-account.js* script.
* **schedule.times** - What times you want this to run every day. Can be an array of times also. Times can be in the format 12, 1200, 12:00, 12:00 PM. They are localtime to the machine.

You can also override anything in **config/default.json** by adding it to this file.

### Accounts
Accounts are created by running the *bin/add-account.js* script. Running the script will issue a bunch of prompts. Make sure you have the base64 *crypt.key* from the *config/local.json* handy to copy and paste when asked for it.

This script also will ask for your wallet Private Key. It will encrypt it with the key you specify and write it to a file.

**It is your absolute responsibility** to make sure this code is not sending me your Private Key. Do not trust me. You do not know me. Guard your wallet Private Key very closely. With that said, obviously I don't want to steal your crypto. But how would you know that?

#### Breakdown of the accounts in config/local.json
* **key** - Basically a free string name for the account. By default, if **keyFile** is not specified, it will look for your Private Key for this account in **data/privateKeys/[key]**. Unless you changed the Private Keys path in **config/local.json**.
* **keyFile** - If you want to specify the name of your Private Key file instead of letting the program use what is in **key**. Useful if one wallet will be doing for example the Faucet and Garden interactions. This is optional.
* **driver** - What contract the interaction will take place using. See below for a list of drivers.
* **id** - This is your Wallet ID.
* **actions** - Arrary of tasks. See the driver list for the available task.
- **enabled** - Easily disable an account. This is optional.

### Drivers
* **faucet** - DRIP faucet. Actions are one of "claim", "hydrate", "noop".
* **garden** - Animal farm garden. Actions are one of "claim", "plain", "noop".
* **stampede** - Trunk Stampede. Actions are "roll" and "claim", and "noop".
* **furio** - Furio. Actions "compound" and "claim", and "noop".
* **arkfi** - Arkfi.io. The actions are given in compound/withdraw/airdrop values. For example, "60/40/0" or even just "60/40". This will result in 60% compound, 40% withdraw, 0% airdrop. If your percents don't total 100% it'll fail. If you write anything other than any format split of "x/y/z" or "x/y" it'll perform a noop. So "noop" works, too. Technically, you can write "100" for a 100% compound schedule, but you have to own an NFT or something for that. Check out the rules for what you are allowed to do.

### Further securing your Private Keys
I use encfs to encrypt my Private Keys directory. It's not 100% secure. But at least it's another level of security (see https://xkcd.com/538/).

# TODOs
* Make the drivers more hot pluggable.
