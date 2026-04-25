

# Visual Moderation - Overview

## Introduction

### V3 (Demo) vs V2 (Enterprise) at a glance

* **V3 API** — easiest to try today in the [Playground](https://thehive.ai/models/hive/visual-moderation).\
  **For developer testing ONLY**: 100 requests/day limit. Great UI for testing and proofs-of-concept.\
  **Note: Visual Moderation requires an annual contract. Smaller customers should use our self-serve[VLM](https://thehive.ai/models/hive/vision-language-model).**
* **V2 API** — Enterprise project with dedicated API keys, higher limits, and additional stats.

> 📘 Try the [Playground](https://thehive.ai/models/hive/visual-moderation) now. See the API tab there for code samples.
>
> Need higher volume? [Contact us](https://thehive.ai/contact-us?source=docs-visual-moderation-overview) and we’ll increase your V3 limits or create an Enterprise project.

### How Visual Moderation works

Hive's **Visual Moderation** classifies an entire image or video into different categories and assigns a confidence score to each class. Our model is *multi-headed*, where each *head* contains a set of model classes with scores that sum to 1.

For example, given these two Visual Moderation heads:

**NSFW:** `general_nsfw`, `general_suggestive`, `general_not_nsfw_not_suggestive`

**Guns:** `gun_in_hand`, `animated_gun`, `gun_not_in_hand`, `no_gun`

The confidence scores for each model head sum to 1.

```json Sample output
{
  "output": [
    {
      "time": 0,
      "classes": [
        { "class": "general_nsfw", "score": 0.9 },
        { "class": "general_suggestive", "score": 0.05 },
        { "class": "general_not_nsfw_not_suggestive", "score": 0.05 },
        { "class": "gun_in_hand", "score": 0.88 },
        { "class": "animated_gun", "score": 0.04 },
        { "class": "gun_not_in_hand", "score": 0.04 },
        { "class": "no_gun", "score": 0.04 }
      ]
    }
  ]
}

```

## Quickstart (V2)

An example cURL request for this API is shown below. For more information, see the V2 [Sync API](https://docs.thehive.ai/reference/submit-a-task-synchronously) and [Async API](https://docs.thehive.ai/reference/submit-a-task-asynchronously) guides.

```curl
# Submit a task with an image URL (sync)
curl --request POST \
  --url https://api.thehive.ai/api/v2/task/sync \
  --header 'accept: application/json' \
  --header 'authorization: Token <API_KEY>' \
  --form 'url=http://hive-public.s3.amazonaws.com/demo_request/gun1.jpg'

# Submit a task with a local file (sync)
curl --request POST \
  --url https://api.thehive.ai/api/v2/task/sync \
  --header 'Authorization: Token <API_KEY>' \
  --form 'media=@"<absolute/path/to/file>"'

```

> If integrating with V3 API, check out the **API** tab on the [Playground](https://thehive.ai/models/hive/visual-moderation) (default limit 100/day).

To find your API key, go to your dedicated projects, find the Visual Moderation project, and click the "Integration & API Keys" button.

<Image align="center" border={true} src="https://files.readme.io/0808451e7107dd3a1e313692dd6432bfb96b30e4c89db2fe59828d60c2d36697-Screenshot_2025-09-16_at_10.45.29_AM.png" className="border" />

For a more comprehensive API integration guide, visit [this guide](https://docs.thehive.ai/docs/visual-moderation-api).

### Inputs & Streams

**Images & video**: Hive splits videos into individual image frames, runs the model per frame, and aggregates results. The API response is similar for both images and videos, but for videos we include multiple timestamps.

**Livestreams (RTMP/HLS)**: Submit a live stream URL, and we'll sample (default 1 FPS) and process frames. You can also send short clips (≤ 30s) to both our Visual Moderation and Audio Moderation models.

See our [stream submission guide](https://docs.thehive.ai/reference/submit-a-stream-video-frames) for more information.

Note: [Contact us](https://thehive.ai/contact-us?source=docs-visual-moderation-overview) to have streams allocated to your project before use.

***

## Visual Moderation Heads & Classes

Hive's visual classification models support a wide variety of classes that are relevant to content moderation. Broadly, visual moderation classes can be separated into five main categories: sexual content, violent imagery, drugs, hate imagery, and image attributes. When deciding how to process our API response in order to implement your content policy, you should consult the following class descriptions to decide which classes to moderate.

> 📘 NOTE:
>
> This page simply lists supported visual moderation classes and gives a brief description. For a more detailed breakdown of subject matter flagged by each class, click the class name or go to the [Class Descriptions](https://docs.thehive.ai/docs/sexual-content) subpages.

**Note:** Older versions of the API might not perfectly match the outline below. Please reach out to  [sales@thehive.ai](mailto:sales@thehive.ai) if you would like to access the latest content moderation classes.

### Sexual

**[NSFW Head](https://docs.thehive.ai/docs/sexual-content#nsfw-head):**

* general\_nsfw - genitalia, sexual activity, nudity, buttocks, sex toys, animal genitalia
* general\_suggestive -  shirtless men, underwear / swimwear, sexually suggestive poses without genitalia, occluded or blurred sexual activity
* general\_not\_nsfw\_not\_suggestive - none of the above, clean

**[Sexual Activity Head](https://docs.thehive.ai/docs/sexual-content#sexual-activity-head):**

* yes\_sexual\_activity - a sex act or stimulation of genitals are present in the scene
* no\_sexual\_activity - no sex act is present in the scene

**[Realistic NSFW Head](https://docs.thehive.ai/docs/sexual-content#realistic-nsfw-head):**

* yes\_realistic\_nsfw - live nudity, sex acts, or photo-realistic representations of nudity or sex acts
* no\_realistic\_nsfw - non-photorealistic representations of nudity or sex acts (statues, crude drawings, paintings etc.); lack of any NSFW content

**[Female Underwear Head](https://docs.thehive.ai/docs/sexual-content#female-underwear-head):**

* yes\_female\_underwear - lingerie, bras, panties
* no\_female\_underwear

**[Bra Head](https://docs.thehive.ai/docs/sexual-content#bra-head):**

* yes\_bra - standard bras, including ones worn under sheer clothing
* no\_bra

**[Panties Head](https://docs.thehive.ai/docs/sexual-content#panties-head):**

* yes\_panties - women's underwear, including boyshorts and thongs
* no\_panties

**[Negligee Head](https://docs.thehive.ai/docs/sexual-content#negligee-head):**

* yes\_negligee - negligee, chemises, and other sheer, nightgown-type garments
* no\_negligee

**[Male Underwear Head](https://docs.thehive.ai/docs/sexual-content#male-underwear-head):**

* yes\_male\_underwear - fruit-of-the-loom, boxers
* no\_male\_underwear

**[Sex Toy Head](https://docs.thehive.ai/docs/sexual-content#sex-toy-head):**

* yes\_sex\_toy - dildos, certain lingerie
* no\_sex\_toy

**[Cleavage Head](https://docs.thehive.ai/docs/sexual-content#cleavage-head):**

* yes\_cleavage - identifiable female cleavage
* no\_cleavage

**[Female Nudity Head](https://docs.thehive.ai/docs/sexual-content#female-nudity-head):**

* yes\_female\_nudity - breasts or female genitalia
* no\_female\_nudity

**[Male Nudity Head](https://docs.thehive.ai/docs/sexual-content#male-nudity-head):**

* yes\_male\_nudity - male genitalia
* no\_male\_nudity

**[Female Swimwear Head](https://docs.thehive.ai/docs/sexual-content#female-swimwear-head):**

* yes\_female\_swimwear - bikinis, one-pieces, not underwear
* no\_female\_swimwear

**[Bodysuits Head](https://docs.thehive.ai/docs/sexual-content#bodysuits-head):**

* yes\_bodysuit - bodysuits that do not cover the thigh, including corsets
* no\_bodysuit

**[Miniskirts Head](https://docs.thehive.ai/docs/sexual-content#miniskirts-head):**

* yes\_miniskirt - skirts that end above the mid-thigh
* no\_miniskirt

**[Sports Bra Head](https://docs.thehive.ai/docs/sexual-content#sports-bra-head-head):**

* yes\_sports\_bra - sports bras, bralettes, bandeaus, and other bra-like clothing
* no\_sports\_bra

**[Sportswear Bottoms Head](https://docs.thehive.ai/docs/sexual-content#sportswear-bottoms-head):**

* yes\_sportswear\_bottoms - bottoms worn during exercise
* no\_sportswear\_bottoms

[**Bulges Head (Beta)**](https://docs.thehive.ai/docs/sexual-content#bulges-head-beta)

* yes\_bulge - penises that are visible underneath clothing
* no\_bulge

[**Breast Head (Beta)**](https://docs.thehive.ai/docs/sexual-content#breast-head-beta)

* yes\_breast - female breasts where nipples or areolas are visible
* no\_breast

[**Genitals Head (Beta)**](https://docs.thehive.ai/docs/sexual-content#genitals-head-beta)

* yes\_genitals - human genitals (vulvas, penises, testicles)
* no\_genitals

[**Butt Head (Beta)**](https://docs.thehive.ai/docs/sexual-content#butt-head-beta)

* yes\_butt - exposed butts
* no\_butt

[**Tongue Head (Beta)**](https://docs.thehive.ai/docs/sexual-content#tongue-head-beta)

* kissing - mouth-to-mouth contact as well as cheek and forehead kisses
* licking - mouth-to-body contact of any kind, including oral sex
* no\_tongue

**[Shirtless Male Head](https://docs.thehive.ai/docs/sexual-content#shirtless-male-head):**

* yes\_male\_shirtless - shirtless below mid-chest
* no\_male\_shirtless

**[Sexual Intent Head](https://docs.thehive.ai/docs/sexual-content#sexual-intent-head):**

* yes\_sexual\_intent - occluded, blurred, or hidden sexual activity
* no\_sexual\_intent

**[Undressed Head](https://docs.thehive.ai/docs/sexual-content#undressed-head):**

* yes\_undressed - a subject is nude/unclothed, even if genitals etc. are not visible due to pose or digital overlay, or are covered by an object
* no\_undressed - underwear, swimwear, shirtless men if not evident they are nude

**[Animal Genitalia Head](https://docs.thehive.ai/docs/sexual-content#animal-genitalia-head):**

* animal\_genitalia\_and\_human - sexual activity including both animals and humans
* animal\_genitalia\_only - animals mating and pictures of animal genitalia
* animated\_animal\_genitalia - drawings of sexual activity involving animals
* no\_animal\_genitalia - none of the above, clean

### Violence

**[Gun Head](https://docs.thehive.ai/docs/class-descriptions-violence-gore#gun-head):**

* gun\_in\_hand - person holding rifle, handgun
* gun\_not\_in\_hand - rifle, handgun, not in hand
* animated\_gun - gun in games, cartoons, etc. can be in-hand or not.
* no\_gun

**[Knife Head](https://docs.thehive.ai/docs/class-descriptions-violence-gore#knife-head):**

* knife\_in\_hand - person holding knife, sword, machete, razor blade
* knife\_not\_in\_hand - knife, sword, machete, razor blade, not in hand (outside of culinary settings)
* culinary\_knife\_not\_in\_hand - culinary knives not being held or handled by a person
* culinary\_knife\_in\_hand - knife being used for preparing food
* no\_knife

**[Blood Head](https://docs.thehive.ai/docs/class-descriptions-violence-gore#blood-head):**

* very\_bloody - gore, visible bleeding, self-cutting
* a\_little\_bloody - fresh cuts / scrapes, light bleeding
* other\_blood - animated blood, fake blood, animal blood such as game dressing
* no\_blood - minor scabs, scars, acne, etc. are not considered ‘blood’ by model

**[Hanging Head](https://docs.thehive.ai/docs/class-descriptions-violence-gore#hanging-head):**

* hanging - the presence of a human hanging by noose (dead or alive)
* noose - a noose is present in the image with no human hanging from it
* no\_hanging\_no\_noose - no person hanging and no noose present

**[Corpses Head (Beta)](https://docs.thehive.ai/docs/class-descriptions-violence-gore#corpse-head):**

* human\_corpse - human dead body present in image
* animated\_corpse: animated dead body present in image
* no\_corpse

**[Emaciated Bodies Head](https://docs.thehive.ai/docs/class-descriptions-violence-gore#emaciated-body-head):**

* yes\_emaciated\_body - emaciated human or animal body present in image
* no\_emaciated\_body

**[Self Harm Head](https://docs.thehive.ai/docs/class-descriptions-violence-gore#self-harm-head):**

* yes\_self\_harm - self cutting, burning, instances of suicide or other self harm methods present in image
* no\_self\_harm

[**Animal Abuse Head (Beta)**](https://docs.thehive.ai/docs/class-descriptions-violence-gore#animal-abuse-head-beta)

* yes\_animal\_abuse - animals being beaten, tortured, or treated inhumanely as well as animals with graphic injuries
* no\_animal\_abuse

[**Fights Head (Beta)**](https://docs.thehive.ai/docs/class-descriptions-violence-gore#fights-head-beta)

* yes\_fight - two or more people engaging in a physical fight
* no\_fight

[**Child Safety Head (Beta)**](https://docs.thehive.ai/docs/class-descriptions-violence-gore#child-safety-head-beta)

* yes\_child\_safety - shirtless child 11 years old or younger present in the image
* no\_child\_safety

### Drugs and other vices

**[Pill Head](https://docs.thehive.ai/docs/class-descriptions-drugs-smoking#pill-head):**

* yes\_pills - pills and / or drug powders
* no\_pills - no pills and / or drug powders

**[Injectable Head](https://docs.thehive.ai/docs/class-descriptions-drugs-smoking#injectable-head):**

* illicit\_injectables - heroin and other illegal injectables
* medical\_injectables - injectables for medical use
* no\_injectables - no injectable drug paraphernalia

**[Smoking Head](https://docs.thehive.ai/docs/class-descriptions-drugs-smoking#smoking-head):**

* yes\_smoking - cigarettes, cigars, marijuana, vapes, or other smoking paraphernalia
* no\_smoking - no cigars, marijuana, vapes, or other smoking paraphernalia

[**Marijuana Head (Beta)**](https://docs.thehive.ai/docs/class-descriptions-drugs-smoking#marijuana-head-beta)

* yes\_marijuana - marijuana or marijuana-related paraphernalia
* no\_marijuana

**[Gambling Head](https://docs.thehive.ai/docs/class-descriptions-drugs-smoking#gambling-head):**

* yes\_gambling - depicts gambling activity like slot machines, casino games, sports betting, or lottery where betting is visible or implied
* no\_gambling - no gambling activity, regular card/dice games or competitive games with no evidence of betting

**[Alcohol Head](https://docs.thehive.ai/docs/class-descriptions-drugs-smoking#alcohol-head):**

* yes\_drinking\_alcohol - depicts alcoholic beverages being consumed
* yes\_alcohol - depicts alcoholic beverages, present but not being consumed
* animated\_alcohol - depicts alcoholic beverages in animated movies, cartoons, or art
* no\_alcohol - does not depict alcoholic beverages or identifiable alcohol use

### Hate

**[Nazi Head](https://docs.thehive.ai/docs/class-descriptions-hate-bullying#nazi-head):**

* yes\_nazi - Nazi symbols
* no\_nazi - absence of the above

**[Terrorist Head](https://docs.thehive.ai/docs/class-descriptions-hate-bullying#terrorism-head):**

* yes\_terrorist - ISIS flag
* no\_terrorist -  absence of the above

**[KKK Head](https://docs.thehive.ai/docs/class-descriptions-hate-bullying#/kkk-head):**

* yes\_kkk - KKK symbols
* no\_kkk - absence of the above

**[Confederate Flag Head](https://docs.thehive.ai/docs/class-descriptions-hate-bullying#confederate-flag-head):**

* yes\_confederate - shows the Confederate "stars and bars," including graphics, clothing, tattoos, and spinoff flags
* no\_confederate - absence of the above

**[Middle Finger Head](https://docs.thehive.ai/docs/class-descriptions-hate-bullying#middle-finger-head):**

* yes\_middle\_finger - middle finger
* no\_middle\_finger - absence of the above

### Other Attributes

**[Text Head](https://docs.thehive.ai/docs/class-descriptions-other-misc-characteristics#/text-head) :**

* text - any form of text or writing is present somewhere on the image
* no\_text - no text present in the image

**[Overlay Text Head](https://docs.thehive.ai/docs/class-descriptions-other-misc-characteristics#/overlay-text-head):**

* yes\_overlay\_text - digitally overlaid text is present on an image (think meme text)
* no\_overlay\_text - lack of digitally overlaid text in the image

**[Child Presence](https://docs.thehive.ai/docs/class-descriptions-other-misc-characteristics#/child-presence-head):**

* yes\_child\_present: a baby or toddler is present in the image
* no\_child\_present

**[Religious Icons (Beta)](https://docs.thehive.ai/docs/class-descriptions-other-misc-characteristics#/religious-icons-head-beta)**

* yes\_religious\_icon: a religious icon is present in this image
* no\_religious\_icon

**[Drawings (Beta)](https://docs.thehive.ai/docs/class-descriptions-image-characteristics#drawing-head):**

* yes\_drawing: a drawing, painting, or sketch is the central part of the image
* no\_drawing

**[Image Type Head](https://docs.thehive.ai/docs/class-descriptions-other-misc-characteristics#/image-type-head):**

* animated - the image is animated
* hybrid - the image is partially animated
* natural - the image has no animation

[**QR Codes Head**](https://docs.thehive.ai/docs/class-descriptions-other-misc-characteristics#/qr-codes-head):

* yes\_qr\_code - the image contains a QR code
* no\_qr\_code - the image does not contain a QR code

## Brand Safety & Suitability - GARM taxonomy

Hive's Brand Safety and Brand Suitability APIs are powered by Hive's visual moderation model and are additionally mapped to the GARM Brand Safety & Suitability Framework (Global Alliance for Responsible Media), which was established as an industry-standard for categorizing harmful content. For more information click [here](https://docs.thehive.ai/docs/brand-safety-and-suitability).

## Request Format (V2)

The request format for this API includes a field for the media being submitted, either as a local file path or as a url. For more information about submitting a task, see our API reference guides to [synchronous](https://docs.thehive.ai/reference/submit-a-task-synchronously) and [asynchronous](https://docs.thehive.ai/reference/submit-a-task-asynchronously) submissions.

```curl
# Submit a task with an image URL
curl --request POST \
  --url https://api.thehive.ai/api/v2/task/sync \ # this is a sync example, see API reference for async
  --header 'accept: application/json' \
  --header 'authorization: token <API_KEY>' \
  --form 'url=http://hive-public.s3.amazonaws.com/demo_request/gun1.jpg'

# Submit a task with a local file
 curl --request POST \
     --url https://api.thehive.ai/api/v2/task/sync \ # this is a sync example, see API reference for async
     --header 'Authorization: Token <token>' \
     --form 'media=@"<absolute/path/to/file>"'
```

**To get started with V3,** check out our [Playground](https://thehive.ai/models/hive/visual-moderation) and go to our "API" tab for code samples.

## Choosing Thresholds for Visual Moderation

> **Note:** V3 returns the same class names and confidence scores as V2, so your threshold logic stays unchanged.

For each of the classes mentioned above, you will need to set thresholds to decide when to take action based on our model results. For optimum results, a proper threshold analysis on a natural distribution of your data is recommended (for more on this please contact Hive at the email below). Generally, though, a model confidence score threshold of **>.90** is a good place to start to flag an image for any class of interest.

For questions on best practices, please message your point of contact at Hive or send a message to [api@thehive.ai](mailto:api@thehive.ai) to contact our API team directly.

## Supported File Types

**Image Formats:**\
gif\
jpg\
png\
webp

**Video Formats:**\
mp4\
webm\
avi\
mkv\
wmv\
mov

## Thresholds

We recommend a threshold of **0.9** for optimized model performance.

We recommend that you start off with these thresholds, but you should always refine these thresholds to suit your specific use case.