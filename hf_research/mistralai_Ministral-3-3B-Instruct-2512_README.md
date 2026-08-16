---
library_name: vllm
language:
- en
- fr
- es
- de
- it
- pt
- nl
- zh
- ja
- ko
- ar
license: apache-2.0
inference: false
base_model:
- mistralai/Ministral-3-3B-Base-2512
extra_gated_description: >-
  If you want to learn more about how we process your personal data, please read
  our <a href="https://mistral.ai/terms/">Privacy Policy</a>.
tags:
- mistral-common
---

# Ministral 3 3B Instruct 2512
The smallest model in the Ministral 3 family, **Ministral 3 3B** is a powerful, efficient tiny language model with vision capabilities.

This model is the instruct post-trained version in **FP8**, fine-tuned for instruction tasks, making it ideal for chat and instruction based use cases.

The Ministral 3 family is designed for edge deployment, capable of running on a wide range of hardware. Ministral 3 3B can even be deployed locally, capable of fitting in 8GB of VRAM in FP8, and less if further quantized.

Learn more in our [blog post](https://mistral.ai/news/mistral-3) and [paper](https://arxiv.org/abs/2601.08584).

## Key Features
Ministral 3 3B consists of two main architectural components:
- **3.4B Language Model**
- **0.4B Vision Encoder**

The Ministral 3 3B Instruct model offers the following capabilities:
- **Vision**: Enables the model to analyze images and provide insights based on visual content, in addition to text.
- **Multilingual**: Supports dozens of languages, including English, French, Spanish, German, Italian, Portuguese, Dutch, Chinese, Japanese, Korean, Arabic.
- **System Prompt**: Maintains strong adherence and support for system prompts.
- **Agentic**: Offers best-in-class agentic capabilities with native function calling and JSON outputting.
- **Edge-Optimized**: Delivers best-in-class performance at a small scale, deployable anywhere.
- **Apache 2.0 License**: Open-source license allowing usage and modification for both commercial and non-commercial purposes.
- **Large Context Window**: Supports a 256k context window.

### Use Cases
Ideal for lightweight, real-time applications on edge or low-resource devices, such as:
- Image captioning
- Text classification
- Real-time efficient translation
- Data extraction
- Short content generation
- Fine-tuning and specialization
- And more...
  
Bringing advanced AI capabilities to edge and distributed environments for embedded systems.

### Recommended Settings

We recommend deploying with the following best practices:
- System Prompt: Define a clear environment and use case, including guidance on how to effectively leverage tools in agentic systems.
- Sampling Parameters: Use a **temperature below 0.1** for daily-driver and production environments ; Higher temperatures may be explored for creative use cases - developers are encouraged to experiment with alternative settings.
- Tools: Keep the set of tools well-defined and limit their number to the minimum required for the use case - Avoiding overloading the model with an excessive number of tools.
- Vision: When deploying with vision capabilities, we recommend maintaining an aspect ratio close to 1:1 (width-to-height) for images. Avoiding the use of overly thin or wide images - crop them as needed to ensure optimal performance.

### Recommended Sampling

* We recommend starting with a Temperature of 0.1 for most use cases. Feel free to experiment with different settings to best suit your specific needs.

## Ministral 3 Family

| Model Name                     | Type               | Precision | Link                                                                                     |
|--------------------------------|--------------------|-----------|------------------------------------------------------------------------------------------|
| Ministral 3 3B Base 2512       | Base pre-trained   | BF16      | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-3B-Base-2512)                |
| **Ministral 3 3B Instruct 2512**   | **Instruct post-trained** | **FP8**   | [**Hugging Face**](https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512)            |
| Ministral 3 3B Reasoning 2512  | Reasoning capable  | BF16      | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-3B-Reasoning-2512)           |
| Ministral 3 8B Base 2512       | Base pre-trained   | BF16      | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-8B-Base-2512)                |
| Ministral 3 8B Instruct 2512   | Instruct post-trained | FP8    | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512)            |
| Ministral 3 8B Reasoning 2512  | Reasoning capable  | BF16      | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-8B-Reasoning-2512)           |
| Ministral 3 14B Base 2512      | Base pre-trained**   | BF16      | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-14B-Base-2512)               |
| Ministral 3 14B Instruct 2512  | Instruct post-trained | FP8    | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-14B-Instruct-2512)           |
| Ministral 3 14B Reasoning 2512 | Reasoning capable  | BF16      | [Hugging Face](https://huggingface.co/mistralai/Ministral-3-14B-Reasoning-2512)          |

Other formats available [here](https://huggingface.co/collections/mistralai/ministral-3-additional-checkpoints).

## Benchmark Results

We compare Ministral 3 to similar sized models.

### Reasoning

| Model                     | AIME25      | AIME24      | GPQA Diamond | LiveCodeBench |
|---------------------------|-------------|-------------|--------------|---------------|
| **Ministral 3 14B**       | <u>0.850</u>| <u>0.898</u>| <u>0.712</u> | <u>0.646</u>  |
| Qwen3-14B (Thinking)      | 0.737       | 0.837       | 0.663        | 0.593         |
|                           |             |             |              |               |
| **Ministral 3 8B**        | 0.787       | <u>0.860</u>| 0.668        | <u>0.616</u>  |
| Qwen3-VL-8B-Thinking      | <u>0.798</u>| <u>0.860</u>| <u>0.671</u> | 0.580         |
|                           |             |             |              |               |
| **Ministral 3 3B**        | <u>0.721</u>| <u>0.775</u>| 0.534        | <u>0.548</u>  |
| Qwen3-VL-4B-Thinking      | 0.697       | 0.729       | <u>0.601</u> | 0.513         |

### Instruct

| Model                     | Arena Hard  | WildBench  | MATH Maj@1  | MM MTBench       |
|---------------------------|-------------|------------|-------------|------------------|
| **Ministral 3 14B**       | <u>0.551</u>| <u>68.5</u>| <u>0.904</u>| <u>8.49</u>      |
| Qwen3 14B (Non-Thinking)  | 0.427       | 65.1       | 0.870       | NOT MULTIMODAL   |
| Gemma3-12B-Instruct       | 0.436       | 63.2       | 0.854       | 6.70             |
|                           |             |            |             |                  |
| **Ministral 3 8B**        | 0.509       | <u>66.8</u>| 0.876       | <u>8.08</u>      |
| Qwen3-VL-8B-Instruct      | <u>0.528</u>| 66.3       | <u>0.946</u>| 8.00             |
|                           |             |            |             |                  |
| **Ministral 3 3B**        | 0.305       | <u>56.8</u>| 0.830       | 7.83             |
| Qwen3-VL-4B-Instruct      | <u>0.438</u>| <u>56.8</u>| <u>0.900</u>| <u>8.01</u>      |
| Qwen3-VL-2B-Instruct      | 0.163       | 42.2       | 0.786       | 6.36             |
| Gemma3-4B-Instruct        | 0.318       | 49.1       | 0.759       | 5.23             |

### Base

| Model               | Multilingual MMLU | MATH CoT 2-Shot | AGIEval 5-shot | MMLU Redux 5-shot | MMLU 5-shot | TriviaQA 5-shot |
|---------------------|-------------------|-----------------|----------------|-------------------|-------------|-----------------|
| **Ministral 3 14B** | 0.742             | <u>0.676</u>    | 0.648          | 0.820             | 0.794       | 0.749           |
| Qwen3 14B Base      | <u>0.754</u>      | 0.620           | <u>0.661</u>   | <u>0.837</u>      | <u>0.804</u>| 0.703           |
| Gemma 3 12B Base    | 0.690             | 0.487           | 0.587          | 0.766             | 0.745       | <u>0.788</u>    |
|                     |                   |                 |                |                   |             |                 |
| **Ministral 3 8B**  | <u>0.706</u>      | <u>0.626</u>    | 0.591          | 0.793             | <u>0.761</u>| <u>0.681</u>    |
| Qwen 3 8B Base      | 0.700             | 0.576           | <u>0.596</u>   | <u>0.794</u>      | 0.760       | 0.639           |
|                     |                   |                 |                |                   |             |                 |
| **Ministral 3 3B**  | 0.652             | <u>0.601</u>    | 0.511          | 0.735             | 0.707       | 0.592           |
| Qwen 3 4B Base      | <u>0.677</u>      | 0.405           | <u>0.570</u>   | <u>0.759</u>      | <u>0.713</u>| 0.530           |
| Gemma 3 4B Base     | 0.516             | 0.294           | 0.430          | 0.626             | 0.589       | <u>0.640</u>    |

## Usage

The model can be used with the following frameworks;
- [`vllm`](https://github.com/vllm-project/vllm): See [here](#vllm)
- [`transformers`](https://github.com/huggingface/transformers): See [here](#transformers)
  
### vLLM

We recommend using this model with [vLLM](https://github.com/vllm-project/vllm).

#### Installation

Make sure to install **vllm >= 0.12.0**:

```
pip install vllm --upgrade
```

Doing so should automatically install [`mistral_common >= 1.8.6`](https://github.com/mistralai/mistral-common/releases/tag/v1.8.6).

To check:
```
python -c "import mistral_common; print(mistral_common.__version__)"
```

You can also make use of a ready-to-go [docker image](https://github.com/vllm-project/vllm/blob/main/docker/Dockerfile) or on the [docker hub](https://hub.docker.com/layers/vllm/vllm-openai/latest).

#### Serve

Due to their size and the FP8 format of their weights `Ministral-3-3B-Instruct-2512`, `Ministral-3-8B-Instruct-2512` and `Ministral-3-14B-Instruct-2512` can run on a single 1xH200 GPU.

A simple launch command is:

```bash
vllm serve mistralai/Ministral-3-3B-Instruct-2512 \
  --tokenizer_mode mistral --config_format mistral --load_format mistral \
  --enable-auto-tool-choice --tool-call-parser mistral
```

Key parameter notes:

* enable-auto-tool-choice: Required when enabling tool usage.
* tool-call-parser mistral: Required when enabling tool usage.


Additional flags:

* You can set `--max-model-len` to preserve memory. By default it is set to `262144` which is quite large but not necessary for most scenarios.
* You can set `--max-num-batched-tokens` to balance throughput and latency, higher means higher throughput but higher latency.
  
#### Usage of the model

Here we assume that the model `mistralai/Ministral-3-3B-Instruct-2512` is served and you can ping it to the domain `localhost` with the port `8000` which is the default for vLLM.

<details>
  <summary>Vision Reasoning</summary>

Let's see if the Ministral 3 knows when to pick a fight !

```python
from datetime import datetime, timedelta

from openai import OpenAI
from huggingface_hub import hf_hub_download

# Modify OpenAI's API key and API base to use vLLM's API server.
openai_api_key = "EMPTY"
openai_api_base = "http://localhost:8000/v1"

TEMP = 0.15
MAX_TOK = 262144

client = OpenAI(
    api_key=openai_api_key,
    base_url=openai_api_base,
)

models = client.models.list()
model = models.data[0].id


def load_system_prompt(repo_id: str, filename: str) -> str:
    file_path = hf_hub_download(repo_id=repo_id, filename=filename)
    with open(file_path, "r") as file:
        system_prompt = file.read()
    today = datetime.today().strftime("%Y-%m-%d")
    yesterday = (datetime.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    model_name = repo_id.split("/")[-1]
    return system_prompt.format(name=model_name, today=today, yesterday=yesterday)


SYSTEM_PROMPT = load_system_prompt(model, "SYSTEM_PROMPT.txt")
image_url = "https://static.wikia.nocookie.net/essentialsdocs/images/7/70/Battle.png/revision/latest?cb=20220523172438"

messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "What action do you think I should take in this situation? List all the possible actions and explain why you think they are good or bad.",
            },
            {"type": "image_url", "image_url": {"url": image_url}},
        ],
    },
]


response = client.chat.completions.create(
    model=model,
    messages=messages,
    temperature=TEMP,
    max_tokens=MAX_TOK,
)

print(response.choices[0].message.content)
```

</details>

<details>
  <summary>Function Calling</summary>

Let's solve some equations thanks to our simple Python calculator tool.

```python
import json
from openai import OpenAI
from huggingface_hub import hf_hub_download

# Modify OpenAI's API key and API base to use vLLM's API server.
openai_api_key = "EMPTY"
openai_api_base = "http://localhost:8000/v1"

TEMP = 0.15
MAX_TOK = 262144

client = OpenAI(
    api_key=openai_api_key,
    base_url=openai_api_base,
)

models = client.models.list()
model = models.data[0].id


def load_system_prompt(repo_id: str, filename: str) -> str:
    file_path = hf_hub_download(repo_id=repo_id, filename=filename)
    with open(file_path, "r") as file:
        system_prompt = file.read()
    return system_prompt


SYSTEM_PROMPT = load_system_prompt(model, "SYSTEM_PROMPT.txt")

image_url = "https://math-coaching.com/img/fiche/46/expressions-mathematiques.jpg"


def my_calculator(expression: str) -> str:
    return str(eval(expression))


tools = [
    {
        "type": "function",
        "function": {
            "name": "my_calculator",
            "description": "A calculator that can evaluate a mathematical expression.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "The mathematical expression to evaluate.",
                    },
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rewrite",
            "description": "Rewrite a given text for improved clarity",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The input text to rewrite",
                    }
                },
            },
        },
    },
]

messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "Thanks to your calculator, compute the results for the equations that involve numbers displayed in the image.",
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": image_url,
                },
            },
        ],
    },
]

response = client.chat.completions.create(
    model=model,
    messages=messages,
    temperature=TEMP,
    max_tokens=MAX_TOK,
    tools=tools,
    tool_choice="auto",
)

tool_calls = response.choices[0].message.tool_calls

results = []
for tool_call in tool_calls:
    function_name = tool_call.function.name
    function_args = tool_call.function.arguments
    if function_name == "my_calculator":
        result = my_calculator(**json.loads(function_args))
        results.append(result)

messages.append({"role": "assistant", "tool_calls": tool_calls})
for tool_call, result in zip(tool_calls, results):
    messages.append(
        {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "name": tool_call.function.name,
            "content": result,
        }
    )


response = client.chat.completions.create(
    model=model,
    messages=messages,
    temperature=TEMP,
    max_tokens=MAX_TOK,
)

print(response.choices[0].message.content)
```

</details>

<details>
  <summary>Text-Only Request</summary>

Ministral 3 can follow your instructions to the letter.

```python
from openai import OpenAI
from huggingface_hub import hf_hub_download

# Modify OpenAI's API key and API base to use vLLM's API server.
openai_api_key = "EMPTY"
openai_api_base = "http://localhost:8000/v1"

TEMP = 0.15
MAX_TOK = 262144

client = OpenAI(
    api_key=openai_api_key,
    base_url=openai_api_base,
)

models = client.models.list()
model = models.data[0].id


def load_system_prompt(repo_id: str, filename: str) -> str:
    file_path = hf_hub_download(repo_id=repo_id, filename=filename)
    with open(file_path, "r") as file:
        system_prompt = file.read()
    return system_prompt


SYSTEM_PROMPT = load_system_prompt(model, "SYSTEM_PROMPT.txt")

messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {
        "role": "user",
        "content": "Write me a sentence where every word starts with the next letter in the alphabet - start with 'a' and end with 'z'.",
    },
]

response = client.chat.completions.create(
    model=model,
    messages=messages,
    temperature=TEMP,
    max_tokens=MAX_TOK,
)

assistant_message = response.choices[0].message.content
print(assistant_message)
```

</details>

### Transformers

You can also use Ministral 3 3B Instruct 2512 with `Transformers` !

Transformers recently added support for FP8, so make sure to install from main:

```sh
uv pip install git+https://github.com/huggingface/transformers
```

To make the best use of our model with `Transformers` make sure to have [installed](https://github.com/mistralai/mistral-common) `mistral-common >= 1.8.6` to use our tokenizer.

```bash
pip install mistral-common --upgrade
```

Try it out by running the following snippet.

> [!Tip]
> On latest main as of 05/12/2025, by default
> a FP8 triton kernel for fast accelerated matmuls
> (`w8a8_block_fp8_matmul_triton`) will be used
> without any degradation in accuracy. However, if you want to
> run your model in BF16 see ([here](#transformers-bf16))

<details>
  <summary>Python snippet</summary>

```python
import torch
from transformers import Mistral3ForConditionalGeneration, MistralCommonBackend

model_id = "mistralai/Ministral-3-3B-Instruct-2512"

tokenizer = MistralCommonBackend.from_pretrained(model_id)
model = Mistral3ForConditionalGeneration.from_pretrained(model_id, device_map="auto")

image_url = "https://static.wikia.nocookie.net/essentialsdocs/images/7/70/Battle.png/revision/latest?cb=20220523172438"

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "What action do you think I should take in this situation? List all the possible actions and explain why you think they are good or bad.",
            },
            {"type": "image_url", "image_url": {"url": image_url}},
        ],
    },
]

tokenized = tokenizer.apply_chat_template(messages, return_tensors="pt", return_dict=True)

tokenized["input_ids"] = tokenized["input_ids"].to(device="cuda")
tokenized["pixel_values"] = tokenized["pixel_values"].to(dtype=torch.bfloat16, device="cuda")
image_sizes = [tokenized["pixel_values"].shape[-2:]]

output = model.generate(
    **tokenized,
    image_sizes=image_sizes,
    max_new_tokens=512,
)[0]

decoded_output = tokenizer.decode(output[len(tokenized["input_ids"][0]):])
print(decoded_output)
```

</details>

#### Transformers BF16

Transformers allows you to automatically convert the checkpoint to Bfloat16. To do so, simply load the model as follows:

```py
from transformers import Mistral3ForConditionalGeneration, FineGrainedFP8Config

model_id = "mistralai/Ministral-3-3B-Instruct-2512"
model = Mistral3ForConditionalGeneration.from_pretrained(
    model_id,
    device_map="auto",
    quantization_config=FineGrainedFP8Config(dequantize=True)
)
```

## License

This model is licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0.txt).

*You must not use this model in a manner that infringes, misappropriates, or otherwise violates any third party’s rights, including intellectual property rights.*