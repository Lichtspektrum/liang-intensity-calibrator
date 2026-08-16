---
library_name: transformers
license: apache-2.0
language:
- en
- fr
- es
- it
- pt
- zh
- ar
- ru
base_model:
  - HuggingFaceTB/SmolLM3-3B-Base
---


# SmolLM3


![image/png](https://cdn-uploads.huggingface.co/production/uploads/61c141342aac764ce1654e43/zy0dqTCCt5IHmuzwoqtJ9.png)


##  Table of Contents

1. [Model Summary](#model-summary)
2. [How to use](#how-to-use)
3. [Evaluation](#evaluation)
4. [Training](#training)
5. [Limitations](#limitations)
6. [License](#license)

## Model Summary

SmolLM3 is a 3B parameter language model designed to push the boundaries of small models. It supports dual mode reasoning, 6 languages and long context. SmolLM3 is a fully open model that offers strong performance at the 3B–4B scale.

![image/png](https://cdn-uploads.huggingface.co/production/uploads/6200d0a443eb0913fa2df7cc/db3az7eGzs-Sb-8yUj-ff.png)

The model is a decoder-only transformer using GQA and NoPE (with 3:1 ratio), it was pretrained on 11.2T tokens with a staged curriculum of web, code, math and reasoning data. Post-training included midtraining on 140B reasoning tokens followed by supervised fine-tuning and alignment via Anchored Preference Optimization (APO).

### Key features
- Instruct model optimized for **hybrid reasoning**
- **Fully open model**: open weights + full training details including public data mixture and training configs
- **Long context:** Trained on 64k context and supports up to **128k tokens** using YARN extrapolation
- **Multilingual**: 6 natively supported (English, French, Spanish, German, Italian, and Portuguese)

For more details refer to our blog post: https://hf.co/blog/smollm3

## How to use

The modeling code for SmolLM3 is available in transformers `v4.53.0`, so make sure to upgrade your transformers version. You can also load the model with the latest `vllm` which uses transformers as a backend.
```bash
pip install -U transformers
```

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "HuggingFaceTB/SmolLM3-3B"
device = "cuda"  # for GPU usage or "cpu" for CPU usage

# load the tokenizer and the model
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
).to(device)

# prepare the model input
prompt = "Give me a brief explanation of gravity in simple terms."
messages_think = [
    {"role": "user", "content": prompt}
]

text = tokenizer.apply_chat_template(
    messages_think,
    tokenize=False,
    add_generation_prompt=True,
)
model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

# Generate the output
generated_ids = model.generate(**model_inputs, max_new_tokens=32768)

# Get and decode the output
output_ids = generated_ids[0][len(model_inputs.input_ids[0]) :]
print(tokenizer.decode(output_ids, skip_special_tokens=True))
```

>[!TIP]
> We recommend setting `temperature=0.6` and `top_p=0.95` in the sampling parameters.

### Long context processing

The current `config.json` is set for context length up to 65,536 tokens. To handle longer inputs (128k or 256k), we utilize YaRN you can change the `max_position_embeddings` and rope_scaling` to:
```
{
  ...,
  "rope_scaling": {
    "factor": 2.0, #2x65536=131 072 
    "original_max_position_embeddings": 65536,
    "type": "yarn"
  }
}
```


### Enabling and Disabling Extended Thinking Mode

We enable extended thinking by default, so the example above generates the output with a reasoning trace. For choosing between enabling, you can provide the `/think` and `/no_think` flags through the system prompt as shown in the snippet below for extended thinking disabled. The code for generating the response with extended thinking would be the same except that the system prompt should have `/think` instead of `/no_think`.

```python
prompt = "Give me a brief explanation of gravity in simple terms."
messages = [
    {"role": "system", "content": "/no_think"},
    {"role": "user", "content": prompt}
]

text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)
```

We also provide the option of specifying the whether to use extended thinking through the `enable_thinking` kwarg as in the example below. You do not need to set the `/no_think` or `/think` flags through the system prompt if using the kwarg, but keep in mind that the flag in the system prompt overwrites the setting in the kwarg.

```python
prompt = "Give me a brief explanation of gravity in simple terms."
messages = [
    {"role": "user", "content": prompt}
]

text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=False
)
```

### Agentic Usage

SmolLM3 supports tool calling!
Just pass your list of tools:
- Under the argument `xml_tools` for standard tool-calling: these tools will be called as JSON blobs within XML tags, like `<tool_call>{"name": "get_weather", "arguments": {"city": "Copenhagen"}}</tool_call>`
- Or under `python_tools`: then the model will call tools like python functions in a `<code>` snippet, like `<code>get_weather(city="Copenhagen")</code>`

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

checkpoint = "HuggingFaceTB/SmolLM3-3B"

tokenizer = AutoTokenizer.from_pretrained(checkpoint)
model = AutoModelForCausalLM.from_pretrained(checkpoint)

tools = [
    {
        "name": "get_weather",
        "description": "Get the weather in a city",
        "parameters": {"type": "object", "properties": {"city": {"type": "string", "description": "The city to get the weather for"}}}}
]

messages = [
    {
        "role": "user",
        "content": "Hello! How is the weather today in Copenhagen?"
    }
]

inputs = tokenizer.apply_chat_template(
    messages,
    enable_thinking=False, # True works as well, your choice!
    xml_tools=tools,
    add_generation_prompt=True,
    tokenize=True,
    return_tensors="pt"
)

outputs = model.generate(inputs)
print(tokenizer.decode(outputs[0]))
```

### Using Custom System Instructions. 

You can specify custom instruction through the system prompt while controlling whether to use extended thinking. For example, the snippet below shows how to make the model speak like a pirate while enabling extended thinking.

```python
prompt = "Give me a brief explanation of gravity in simple terms."
messages = [
    {"role": "system", "content": "Speak like a pirate./think"},
    {"role": "user", "content": prompt}
]

text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)
```

For local inference, you can use `llama.cpp`, `ONNX`, `MLX`, `MLC` and `ExecuTorch`. You can find quantized checkpoints in this collection (https://huggingface.co/collections/HuggingFaceTB/smollm3-686d33c1fdffe8e635317e23)

### vLLM and SGLang

You can use vLLM and SGLang to deploy the model in an API compatible with OpenAI format.

#### SGLang

```bash
python -m sglang.launch_server --model-path HuggingFaceTB/SmolLM3-3B
```

#### vLLM

```bash
vllm serve HuggingFaceTB/SmolLM3-3B --enable-auto-tool-choice --tool-call-parser=hermes
```

#### Setting `chat_template_kwargs`

You can specify `chat_template_kwargs` such as `enable_thinking` to a deployed model by passing the `chat_template_kwargs` parameter in the API request.

```bash
curl http://localhost:8000/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "HuggingFaceTB/SmolLM3-3B",
  "messages": [
    {"role": "user", "content": "Give me a brief explanation of gravity in simple terms."}
  ],
  "temperature": 0.6,
  "top_p": 0.95,
  "max_tokens": 16384,
  "chat_template_kwargs": {"enable_thinking": false}
}'
```

## Evaluation

In this section, we report the evaluation results of SmolLM3 model. All evaluations are zero-shot unless stated otherwise, and we use [lighteval](https://github.com/huggingface/lighteval) to run them. 

We highlight the best score in bold and underline the second-best score.

### Instruction Model

#### No Extended Thinking
Evaluation results of non reasoning models and reasoning models in no thinking mode. We highlight the best and second-best scores in bold.
| Category | Metric | SmoLLM3-3B | Qwen2.5-3B | Llama3.1-3B | Qwen3-1.7B | Qwen3-4B |
|---------|--------|------------|------------|-------------|------------|----------|
| High school math competition | AIME 2025 | <u>9.3</u> | 2.9 | 0.3 | 8.0 | **17.1** |
| Math problem-solving | GSM-Plus | 72.8 | <u>74.1</u> | 59.2 | 68.3 | **82.1** |
| Competitive programming | LiveCodeBench v4 | <u>15.2</u> | 10.5 | 3.4 | 15.0 | **24.9** |
| Graduate-level reasoning | GPQA Diamond | <u>35.7</u> | 32.2 | 29.4 | 31.8 | **44.4** |
| Instruction following | IFEval | **76.7** | 65.6 | 71.6 | <u>74.0</u> | 68.9 |
| Alignment | MixEval Hard | 26.9 | <u>27.6</u> | 24.9 | 24.3 | **31.6** |
| Tool Calling | BFCL| <u>92.3</u> | - | <u>92.3</u> * | 89.5  | **95.0** |
| Multilingual Q&A | Global MMLU | <u>53.5</u> | 50.54 | 46.8 | 49.5 | **65.1** |

(*): this is a tool calling finetune

#### Extended Thinking
Evaluation results in reasoning mode for SmolLM3 and Qwen3 models: 
| Category | Metric | SmoLLM3-3B | Qwen3-1.7B | Qwen3-4B |
|---------|--------|------------|------------|----------|
| High school math competition | AIME 2025 | <u>36.7</u> | 30.7 | **58.8** |
| Math problem-solving | GSM-Plus | <u>83.4</u> | 79.4 | **88.2** |
| Competitive programming | LiveCodeBench v4 | 30.0 | <u>34.4</u> | **52.9** |
| Graduate-level reasoning | GPQA Diamond | <u>41.7</u> | 39.9 | **55.3** |
| Instruction following | IFEval | 71.2 | <u>74.2</u> | **85.4** |
| Alignment | MixEval Hard | 30.8 | <u>33.9</u> | **38.0** |
| Tool Calling | BFCL | <u>88.8</u> | <u>88.8</u> | **95.5** |
| Multilingual Q&A | Global MMLU | <u>64.1</u> | 62.3 | **73.3** |


### Base Pre-Trained Model

#### English benchmarks
Note: All evaluations are zero-shot unless stated otherwise. For Ruler 64k evaluation, we apply YaRN to the Qwen models with 32k context to extrapolate the context length.

| Category | Metric | SmolLM3-3B | Qwen2.5-3B | Llama3-3.2B | Qwen3-1.7B-Base | Qwen3-4B-Base |
|---------|--------|---------------------|------------|--------------|------------------|---------------|
| Reasoning & Commonsense| HellaSwag | **76.15** | 74.19 |<u>75.52</u> | 60.52 | 74.37 |
| | ARC-CF (Average) | **65.61** | 59.81 | 58.58 | 55.88 | <u>62.11</u> |
| | Winogrande | 58.88 | **61.41** | 58.72 | 57.06 | <u>59.59</u> |
| | CommonsenseQA | <u>55.28</u> | 49.14 | **60.60** | 48.98 | 52.99 |
| Knowledge & Understanding | MMLU-CF (Average) | <u>44.13</u> | 42.93 | 41.32 | 39.11 | **47.65** | 
| | MMLU Pro CF | <u>19.61</u> | 16.66 | 16.42 | 18.04 | **24.92** |
| | MMLU Pro MCF | <u>32.70</u> | 31.32 | 25.07 | 30.39 | **41.07** |
| | PIQA | **78.89** | 78.35 | <u>78.51</u> | 75.35 | 77.58 |
| | OpenBookQA | 40.60 | 40.20 | <u>42.00</u> | 36.40 | **42.40** |
| | BoolQ | **78.99** | 73.61 | <u>75.33</u> | 74.46 | 74.28 | 
| **Math & Code** |  |  |  |  |  |  | 
| Coding & math | HumanEval+ | 30.48 | 34.14| 25.00 | <u>43.29</u>| **54.87** |
| | MBPP+ | 52.91 | 52.11 | 38.88| <u>59.25</u> | **63.75** | 
| | MATH (4-shot) | <u>46.10</u> | 40.10 | 7.44 | 41.64 | **51.20** |
| | GSM8k (5-shot) | 67.63 | <u>70.13</u> | 25.92 | 65.88 | **74.14** | 
| **Long context** |  |  |  |  |  |  | 
| | Ruler 32k | 76.35 | 75.93 | <u>77.58</u> | 70.63 | **83.98** | 
| | Ruler 64k | <u>67.85</u> | 64.90 | **72.93** | 57.18 | 60.29 | 
| | Ruler 128k | 61.03 | <u>62.23</u> | **71.30** | 43.03 | 47.23 | 

#### Multilingual benchmarks


| Category | Metric | SmolLM3 3B Base | Qwen2.5-3B | Llama3.2 3B | Qwen3 1.7B Base | Qwen3 4B Base |
|---------|--------|---------------------|------------|--------------|------------------|---------------|
| Main supported languages |  |  |  |  |  |  |  |
| French| MLMM Hellaswag | **63.94** | 57.47 | 57.66 | 51.26 | <u>61.00</u> |
| | Belebele | 51.00 | <u>51.55</u> | 49.22 |49.44| **55.00** |
| | Global MMLU (CF) | <u>38.37</u> | 34.22  | 33.71 | 34.94  |**41.80** |
| | Flores-200 (5-shot) | 62.85| 61.38| <u>62.89</u> | 58.68 | **65.76** |
| Spanish| MLMM Hellaswag | **65.85** | 58.25 | 59.39 | 52.40 | <u>61.85</u> |
| | Belebele | 47.00 | <u>48.88</u> | 47.00 | 47.56 | **50.33** |
| | Global MMLU (CF) | <u>38.51</u> | 35.84  | 35.60 | 34.79  |**41.22** |
| | Flores-200 (5-shot) | <u>48.25</u>| 50.00| 44.45 | 46.93 | **50.16** |
| German| MLMM Hellaswag | **59.56** | 49.99|  53.19|46.10| <u>56.43</u>|
| | Belebele | <u>48.44</u> | 47.88 | 46.22 | 48.00 | **53.44**|
| | Global MMLU (CF) | <u>35.10</u> | 33.19  | 32.60 | 32.73  |**38.70** |
| | Flores-200 (5-shot) | **56.60**| 50.63| <u>54.95</u> | 52.58 | 50.48 |
| Italian| MLMM Hellaswag | **62.49** | 53.21 | 54.96 | 48.72 | <u>58.76</u> |
| | Belebele | <u>46.44</u> | 44.77 | 43.88 | 44.00 | **48.78** | 44.88 |
| | Global MMLU (CF) | <u>36.99</u> | 33.91  | 32.79 | 35.37  |**39.26** |
| | Flores-200 (5-shot) | <u>52.65<u/>| **54.87**| 48.83 | 48.37 | 49.11 |
| Portuguese| MLMM Hellaswag | **63.22** | 57.38 | 56.84 | 50.73 | <u>59.89</u> |
| | Belebele | 47.67 | **49.22** | 45.00 | 44.00 | 50.00 | <u>49.00</U> |
| | Global MMLU (CF) | <u>36.88</u> | 34.72  | 33.05 | 35.26  |**40.66** |
| | Flores-200 (5-shot) | <u>60.93</u> |57.68| 54.28 | 56.58 | **63.43** |

The model has also been trained on Arabic (standard), Chinese and Russian data, but has seen fewer tokens in these languages compared to the 6 above. We report the performance on these langages for information.
| Category | Metric | SmolLM3 3B Base | Qwen2.5-3B | Llama3.2 3B | Qwen3 1.7B Base | Qwen3 4B Base |
|---------|--------|---------------------|------------|--------------|------------------|---------------|
| Other supported languages |  |  |  |  |  |  |  |
| Arabic| Belebele | 40.22 | 44.22 | <u>45.33</u> | 42.33 | **51.78** |
| | Global MMLU (CF) | 28.57 | 28.81 | 27.67 | <u>29.37</u> | **31.85** |
| | Flores-200 (5-shot) | <u>40.22</u> | 39.44 | **44.43** | 35.82 | 39.76 |
| Chinese| Belebele | 43.78 | 44.56 | <u>49.56</u> | 48.78 | **53.22** |
| | Global MMLU (CF) | 36.16 | 33.79 | <u>39.57</u> | 38.56 | **44.55** |
| | Flores-200 (5-shot) | 29.17 | **33.21** | 31.89 | 25.70 | <u>32.50</u> |
| Russian| Belebele | <u>47.44</u> | 45.89 | <u>47.44</u> | 45.22 | **51.44** |
| | Global MMLU (CF) | <u>36.51</u> | 32.47 | 34.52 | 34.83 | **38.80** |
| | Flores-200 (5-shot) | 47.13 | 48.74 | 50.74 | <u>54.70</u> | **60.53** |

## Training

### Model

- **Architecture:** Transformer decoder
- **Pretraining tokens:** 11T
- **Precision:** bfloat16

### Software & hardware

- **GPUs:** 384 H100
- **Training Framework:** [nanotron](https://github.com/huggingface/nanotron/tree/smollm3)
- **Data processing framework:** [datatrove](https://github.com/huggingface/datatrove)
- **Evaluation framework:** [lighteval](https://github.com/huggingface/lighteval)
- **Post-training Framework:** [TRL](https://github.com/huggingface/trl)

### Open resources
Here is an infographic with all the training details 
- The datasets used for pretraining can be found in this [collection](https://huggingface.co/collections/HuggingFaceTB/smollm3-pretraining-datasets-685a7353fdc01aecde51b1d9) and those used in mid-training and post-training will be uploaded later 
- The training and evaluation configs and code can be found in the [huggingface/smollm](https://github.com/huggingface/smollm) repository.
- The training intermediate checkpoints (including the mid-training and SFT checkpoints) are available at [HuggingFaceTB/SmolLM3-3B-checkpoints](https://huggingface.co/HuggingFaceTB/SmolLM3-3B-checkpoints)
![image/png](https://cdn-uploads.huggingface.co/production/uploads/651e96991b97c9f33d26bde6/qiE5ZYr9SD1CIAtfEfuC8.png)

### EU Summary of Public Content

The EU AI Act requires all GPAI models to provide a Public Summary of Training Content according to a [given template](https://digital-strategy.ec.europa.eu/en/library/explanatory-notice-and-template-public-summary-training-content-general-purpose-ai-models).
You can find the summary for this model below, as well as in its [development Space](https://huggingface.co/spaces/hfmlsoc/smollm3-eu-data-transparency).

<iframe
	src="https://hfmlsoc-smollm3-eu-data-transparency.hf.space"
	frameborder="0"
	width="850"
	height="350"
></iframe>


## Limitations

SmolLM3 can produce text on a variety of topics, but the generated content may not always be factually accurate, logically consistent, or free from biases present in the training data. These models should be used as assistive tools rather than definitive sources of information. Users should always verify important information and critically evaluate any generated content.

## License
[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Citation
```bash
@misc{bakouch2025smollm3,
  title={{SmolLM3: smol, multilingual, long-context reasoner}},
  author={Bakouch, Elie and Ben Allal, Loubna and Lozhkov, Anton and Tazi, Nouamane and Tunstall, Lewis and Patiño, Carlos Miguel and Beeching, Edward and Roucher, Aymeric and Reedi, Aksel Joonas and Gallouédec, Quentin and Rasul, Kashif and Habib, Nathan and Fourrier, Clémentine and Kydlicek, Hynek and Penedo, Guilherme and Larcher, Hugo and Morlon, Mathieu and Srivastav, Vaibhav and Lochner, Joshua and Nguyen, Xuan-Son and Raffel, Colin and von Werra, Leandro and Wolf, Thomas},
  year={2025},
  howpublished={\url{https://huggingface.co/blog/smollm3}}
}
```