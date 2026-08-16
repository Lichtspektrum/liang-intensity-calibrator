---
language:
- multilingual
- ar
- zh
- cs
- da
- nl
- en
- fi
- fr
- de
- he
- hu
- it
- ja
- ko
- 'no'
- pl
- pt
- ru
- es
- sv
- th
- tr
- uk
library_name: transformers
license: mit
license_link: https://huggingface.co/microsoft/Phi-4-mini-instruct/resolve/main/LICENSE
pipeline_tag: text-generation
tags:
- nlp
- code
widget:
- messages:
  - role: user
    content: Can you provide ways to eat combinations of bananas and dragonfruits?
---
🎉**Phi-4**: [[mini-reasoning](https://huggingface.co/microsoft/Phi-4-mini-reasoning) | [reasoning](https://huggingface.co/microsoft/Phi-4-reasoning)] | [[multimodal-instruct](https://huggingface.co/microsoft/Phi-4-multimodal-instruct) | [onnx](https://huggingface.co/microsoft/Phi-4-multimodal-instruct-onnx)]; 
[[mini-instruct](https://huggingface.co/microsoft/Phi-4-mini-instruct) | [onnx](https://huggingface.co/microsoft/Phi-4-mini-instruct-onnx)]


## Model Summary
 
Phi-4-mini-instruct is a lightweight open model built upon synthetic data and filtered publicly available websites - with a focus on high-quality, reasoning dense data. The model belongs to the Phi-4 model family and supports 128K token context length. The model underwent an enhancement process, incorporating both supervised fine-tuning and direct preference optimization to support precise instruction adherence and robust safety measures.
 
📰 [Phi-4-mini Microsoft Blog](https://aka.ms/phi4-feb2025) <br>
📖 [Phi-4-mini Technical Report](https://aka.ms/phi-4-multimodal/techreport) <br>
👩‍🍳 [Phi Cookbook](https://github.com/microsoft/PhiCookBook) <br>
🏡 [Phi Portal](https://azure.microsoft.com/en-us/products/phi) <br>
🖥️ Try It [Azure](https://aka.ms/phi-4-mini/azure), [Huggingface](https://huggingface.co/spaces/microsoft/phi-4-mini) <br>

🚀 [Model paper](https://huggingface.co/papers/2503.01743)
 

## Intended Uses
 
### Primary Use Cases
 
The model is intended for broad multilingual commercial and research use. The model provides uses for general purpose AI systems and applications which require:
 
1) Memory/compute constrained environments
2) Latency bound scenarios
3) Strong reasoning (especially math and logic).
 
The model is designed to accelerate research on language and multimodal models, for use as a building block for generative AI powered features.
 
### Use Case Considerations
 
The model is not specifically designed or evaluated for all downstream purposes. Developers should consider common limitations of language models, as well as performance difference across languages, as they select use cases, and evaluate and mitigate for accuracy, safety, and fairness before using within a specific downstream use case, particularly for high-risk scenarios.
Developers should be aware of and adhere to applicable laws or regulations (including but not limited to privacy, trade compliance laws, etc.) that are relevant to their use case.
 
***Nothing contained in this Model Card should be interpreted as or deemed a restriction or modification to the license the model is released under.***
 
## Release Notes
 
This release of Phi-4-mini-instruct is based on valuable user feedback from the Phi-3 series. The Phi-4-mini model employed new architecture for efficiency, larger vocabulary for multilingual support, and better post-training techniques were used for instruction following, function calling, as well as additional data leading to substantial gains on key capabilities. It is anticipated that most use cases will benefit from this release, but users are encouraged to test in their particular AI applications. The enthusiastic support for the Phi-4 series is greatly appreciated. Feedback on Phi-4-mini-instruct is welcomed and crucial to the model’s evolution and improvement.
 
### Model Quality
 
To understand the capabilities, the 3.8B parameters Phi-4-mini-instruct  model was compared with a set of models over a variety of benchmarks using an internal benchmark platform (See Appendix A for benchmark methodology). A high-level overview of the model quality is as follows:
 
| Benchmark                        | Similar size |                   |                   |                   |                 |2x size                |                   |                   |                   |                   |                   |
|----------------------------------|-------------|-------------------|-------------------|-------------------|-----------------|-----------------|-----------------|-----------------|-----------------|-----------------|-----------------|
|                                  | Phi-4 mini-Ins | Phi-3.5-mini-Ins | Llama-3.2-3B-Ins | Mistral-3B | Qwen2.5-3B-Ins | Qwen2.5-7B-Ins | Mistral-8B-2410 | Llama-3.1-8B-Ins | Llama-3.1-Tulu-3-8B | Gemma2-9B-Ins | GPT-4o-mini-2024-07-18 |
| **Popular aggregated benchmark** |             |                   |                   |                   |                 |                 |                 |                 |                 |                 |                 |
| Arena Hard                       | 32.8        | 34.4              | 17.0              | 26.9              | 32.0            | 55.5            | 37.3            | 25.7            | 42.7            | 43.7            | 53.7            |
| BigBench Hard (0-shot, CoT)      | 70.4        | 63.1              | 55.4              | 51.2              | 56.2            | 72.4            | 53.3            | 63.4            | 55.5            | 65.7            | 80.4            |
| MMLU (5-shot)                    | 67.3        | 65.5              | 61.8              | 60.8              | 65.0            | 72.6            | 63.0            | 68.1            | 65.0            | 71.3            | 77.2            |
| MMLU-Pro (0-shot, CoT)           | 52.8        | 47.4              | 39.2              | 35.3              | 44.7            | 56.2            | 36.6            | 44.0            | 40.9            | 50.1            | 62.8            |
| **Reasoning**                    |             |                   |                   |                   |                 |                 |                 |                 |                 |                 |                 |
| ARC Challenge (10-shot)          | 83.7        | 84.6              | 76.1              | 80.3              | 82.6            | 90.1            | 82.7            | 83.1            | 79.4            | 89.8            | 93.5            |
| BoolQ (2-shot)                   | 81.2        | 77.7              | 71.4              | 79.4              | 65.4            | 80.0            | 80.5            | 82.8            | 79.3            | 85.7            | 88.7            |
| GPQA (0-shot, CoT)               | 25.2        | 26.6              | 24.3              | 24.4              | 23.4            | 30.6            | 26.3            | 26.3            | 29.9            | 39.1            | 41.1            |
| HellaSwag (5-shot)               | 69.1        | 72.2              | 77.2              | 74.6              | 74.6            | 80.0            | 73.5            | 72.8            | 80.9            | 87.1            | 88.7            |
| OpenBookQA (10-shot)             | 79.2        | 81.2              | 72.6              | 79.8              | 79.3            | 82.6            | 80.2            | 84.8            | 79.8            | 90.0            | 90.0            |
| PIQA (5-shot)                    | 77.6        | 78.2              | 68.2              | 73.2              | 72.6            | 76.2            | 81.2            | 83.2            | 78.3            | 83.7            | 88.7            |
| Social IQA (5-shot)              | 72.5        | 75.1              | 68.3              | 73.9              | 75.3            | 75.3            | 77.6            | 71.8            | 73.4            | 74.7            | 82.9            |
| TruthfulQA (MC2) (10-shot)       | 66.4        | 65.2              | 59.2              | 62.9              | 64.3            | 69.4            | 63.0            | 69.2            | 64.1            | 76.6            | 78.2            |
| Winogrande (5-shot)              | 67.0        | 72.2              | 53.2              | 59.8              | 63.3            | 71.1            | 63.1            | 64.7            | 65.4            | 74.0            | 76.9            |
| **Multilingual**                 |             |                   |                   |                   |                 |                 |                 |                 |                 |                 |                 |
| Multilingual MMLU (5-shot)       | 49.3        | 51.8              | 48.1              | 46.4              | 55.9            | 64.4            | 53.7            | 56.2            | 54.5            | 63.8            | 72.9            |
| MGSM (0-shot, CoT)               | 63.9        | 49.6              | 44.6              | 44.6              | 53.5            | 64.5            | 56.7            | 56.7            | 58.6            | 75.1            | 81.7            |
| **Math**                         |             |                   |                   |                   |                 |                 |                 |                 |                 |                 |                 |
| GSM8K (8-shot, CoT)              | 88.6        | 76.9              | 75.6              | 80.1              | 80.6            | 88.7            | 81.9            | 82.4            | 84.3            | 84.9            | 91.3            |
| MATH (0-shot, CoT)               | 64.0        | 49.8              | 46.7              | 41.8              | 61.7            | 60.4            | 41.6            | 47.6            | 46.1            | 51.3            | 70.2            |
| **Overall**                      | **63.5**    | **60.5**          | **56.2**          | **56.9**          | **60.1**        | **67.9**        | **60.2**        | **62.3**        | **60.9**        | **65.0**        | **75.5**        |
 
Overall, the model with only 3.8B-param achieves a similar level of multilingual language understanding and reasoning ability as much larger models. However, it is still fundamentally limited by its size for certain tasks. The model simply does not have the capacity to store too much factual knowledge, therefore, users may experience factual incorrectness. However, it may be possible to resolve such weakness by augmenting Phi-4 with a search engine, particularly when using the model under RAG settings.
 
## Usage
 
### Tokenizer
 
Phi-4-mini-instruct supports a vocabulary size of up to `200064` tokens. The [tokenizer files](https://huggingface.co/microsoft/Phi-4-mini-instruct/blob/main/added_tokens.json) already provide placeholder tokens that can be used for downstream fine-tuning, but they can also be extended up to the model's vocabulary size.
 
### Input Formats
 
Given the nature of the training data, the Phi-4-mini-instruct
model is best suited for prompts using specific formats.
Below are the two primary formats:
 
#### Chat format
 
This format is used for general conversation and instructions:
 
```yaml
<|system|>Insert System Message<|end|><|user|>Insert User Message<|end|><|assistant|>
```
 
#### Tool-enabled function-calling format
 
This format is used when the user wants the model to provide function calls based on the given tools. The user should provide the available tools in the system prompt, wrapped by <|tool|> and <|/tool|> tokens. The tools should be specified in JSON format, using a JSON dump structure. Example:
 
`
<|system|>You are a helpful assistant with some tools.<|tool|>[{"name": "get_weather_updates", "description": "Fetches weather updates for a given city using the RapidAPI Weather API.", "parameters": {"city": {"description": "The name of the city for which to retrieve weather information.", "type": "str", "default": "London"}}}]<|/tool|><|end|><|user|>What is the weather like in Paris today?<|end|><|assistant|>
`

### Inference with vLLM

#### Requirements

List of required packages:

```
flash_attn==2.7.4.post1
torch==2.5.1
vllm>=0.7.3
```

#### Example

To perform inference using vLLM, you can use the following code snippet:

```python
from vllm import LLM, SamplingParams

llm = LLM(model="microsoft/Phi-4-mini-instruct", trust_remote_code=True)

messages = [
    {"role": "system", "content": "You are a helpful AI assistant."},
    {"role": "user", "content": "Can you provide ways to eat combinations of bananas and dragonfruits?"},
    {"role": "assistant", "content": "Sure! Here are some ways to eat bananas and dragonfruits together: 1. Banana and dragonfruit smoothie: Blend bananas and dragonfruits together with some milk and honey. 2. Banana and dragonfruit salad: Mix sliced bananas and dragonfruits together with some lemon juice and honey."},
    {"role": "user", "content": "What about solving an 2x + 3 = 7 equation?"},
]

sampling_params = SamplingParams(
  max_tokens=500,
  temperature=0.0,
)

output = llm.chat(messages=messages, sampling_params=sampling_params)
print(output[0].outputs[0].text)
```

### Inference with Transformers

#### Requirements

 
Phi-4 family has been integrated in the `4.49.0` version of `transformers`. The current `transformers` version can be verified with: `pip list | grep transformers`.
Python 3.8 and 3.10 will work best. 
List of required packages:

```
flash_attn==2.7.4.post1
torch==2.5.1
transformers==4.49.0
accelerate==1.3.0
```
 
Phi-4-mini-instruct is also available in [Azure AI Studio]()

#### Example
 
After obtaining the Phi-4-mini-instruct model checkpoints, users can use this sample code for inference.
 
```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
 
torch.random.manual_seed(0)

model_path = "microsoft/Phi-4-mini-instruct"

model = AutoModelForCausalLM.from_pretrained(
    model_path,
    device_map="auto",
    torch_dtype="auto",
    trust_remote_code=True,
)
tokenizer = AutoTokenizer.from_pretrained(model_path)
 
messages = [
    {"role": "system", "content": "You are a helpful AI assistant."},
    {"role": "user", "content": "Can you provide ways to eat combinations of bananas and dragonfruits?"},
    {"role": "assistant", "content": "Sure! Here are some ways to eat bananas and dragonfruits together: 1. Banana and dragonfruit smoothie: Blend bananas and dragonfruits together with some milk and honey. 2. Banana and dragonfruit salad: Mix sliced bananas and dragonfruits together with some lemon juice and honey."},
    {"role": "user", "content": "What about solving an 2x + 3 = 7 equation?"},
]
 
pipe = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
)
 
generation_args = {
    "max_new_tokens": 500,
    "return_full_text": False,
    "temperature": 0.0,
    "do_sample": False,
}
 
output = pipe(messages, **generation_args)
print(output[0]['generated_text'])
```
 
## Responsible AI Considerations
 
Like other language models, the Phi family of models can potentially behave in ways that are unfair, unreliable, or offensive. Some of the limiting behaviors to be aware of include:
 
+ Quality of Service: The Phi models are trained primarily on English text and some additional multilingual text. Languages other than English will experience worse performance as well as performance disparities across non-English. English language varieties with less representation in the training data might experience worse performance than standard American English.  
+ Multilingual performance and safety gaps: We believe it is important to make language models more widely available across different languages, but the Phi 4 models still exhibit challenges common across multilingual releases. As with any deployment of LLMs, developers will be better positioned to test for performance or safety gaps for their linguistic and cultural context and customize the model with additional fine-tuning and appropriate safeguards.
+ Representation of Harms & Perpetuation of Stereotypes: These models can over- or under-represent groups of people, erase representation of some groups, or reinforce demeaning or negative stereotypes. Despite safety post-training, these limitations may still be present due to differing levels of representation of different groups, cultural contexts, or prevalence of examples of negative stereotypes in training data that reflect real-world patterns and societal biases.
+ Inappropriate or Offensive Content: These models may produce other types of inappropriate or offensive content, which may make it inappropriate to deploy for sensitive contexts without additional mitigations that are specific to the case.
+ Information Reliability: Language models can generate nonsensical content or fabricate content that might sound reasonable but is inaccurate or outdated.  
+ Limited Scope for Code: The majority of Phi 4 training data is based in Python and uses common packages such as "typing, math, random, collections, datetime, itertools". If the model generates Python scripts that utilize other packages or scripts in other languages, it is  strongly recommended that users manually verify all API uses.
+ Long Conversation: Phi 4 models, like other models, can in some cases generate responses that are repetitive, unhelpful, or inconsistent in very long chat sessions in both English and non-English languages. Developers are encouraged to place appropriate mitigations, like limiting conversation turns to account for the possible conversational drift.
 
Developers should apply responsible AI best practices, including mapping, measuring, and mitigating risks associated with their specific use case and cultural, linguistic context. Phi 4 family of models are general purpose models. As developers plan to deploy these models for specific use cases, they are encouraged to fine-tune the models for their use case and leverage the models as part of broader AI systems with language-specific safeguards in place. Important areas for consideration include:  
 
+ Allocation: Models may not be suitable for scenarios that could have consequential impact on legal status or the allocation of resources or life opportunities (ex: housing, employment, credit, etc.) without further assessments and additional debiasing techniques.
+ High-Risk Scenarios: Developers should assess the suitability of using models in high-risk scenarios where unfair, unreliable or offensive outputs might be extremely costly or lead to harm. This includes providing advice in sensitive or expert domains where accuracy and reliability are critical (ex: legal or health advice). Additional safeguards should be implemented at the application level according to the deployment context.
+ Misinformation: Models may produce inaccurate information. Developers should follow transparency best practices and inform end-users they are interacting with an AI system. At the application level, developers can build feedback mechanisms and pipelines to ground responses in use-case specific, contextual information, a technique known as Retrieval Augmented Generation (RAG).  
+ Generation of Harmful Content: Developers should assess outputs for their context and use available safety classifiers or custom solutions appropriate for their use case.
+ Misuse: Other forms of misuse such as fraud, spam, or malware production may be possible, and developers should ensure that their applications do not violate applicable laws and regulations.
 
 
## Training
 
### Model
 
+ **Architecture:** Phi-4-mini-instruct has 3.8B parameters and is a dense decoder-only Transformer model. When compared with Phi-3.5-mini, the major changes with Phi-4-mini-instruct are 200K vocabulary, grouped-query attention, and shared input and output embedding.<br>
+ **Inputs:** Text. It is best suited for prompts using the chat format.<br>
+ **Context length:** 128K tokens<br>
+ **GPUs:** 512 A100-80G<br>
+ **Training time:** 21 days<br>
+ **Training data:** 5T tokens<br>
+ **Outputs:** Generated text in response to the input<br>
+ **Dates:** Trained between November and December 2024<br>
+ **Status:** This is a static model trained on offline datasets with the cutoff date of June 2024 for publicly available data.<br>
+ **Supported languages:** Arabic, Chinese, Czech, Danish, Dutch, English, Finnish, French, German, Hebrew, Hungarian, Italian, Japanese, Korean, Norwegian, Polish, Portuguese, Russian, Spanish, Swedish, Thai, Turkish, Ukrainian<br>
+ **Release date:** February 2025<br>
 
### Training Datasets
 
Phi-4-mini’s training data includes a wide variety of sources, totaling 5 trillion tokens, and is a combination of
1) publicly available documents filtered for quality, selected high-quality educational data, and code
2) newly created synthetic, “textbook-like” data for the purpose of teaching math, coding, common sense reasoning, general knowledge of the world (e.g., science, daily activities, theory of mind, etc.)
3) high quality chat format supervised data covering various topics to reflect human preferences on different aspects such as instruct-following, truthfulness, honesty and helpfulness. Focus was placed on the quality of data that could potentially improve the reasoning ability for the model, and the publicly available documents were filtered to contain a preferred level of knowledge. As an example, the result of a game in premier league on a particular day might be good training data for frontier models, but such information was removed to leave more model capacity for reasoning for the model’s small size. More details about data can be found in the Phi-4-mini-instruct technical report.
 
The decontamination process involved normalizing and tokenizing the dataset, then generating and comparing n-grams between the target dataset and benchmark datasets. Samples with matching n-grams above a threshold were flagged as contaminated and removed from the dataset. A detailed contamination report was generated, summarizing the matched text, matching ratio, and filtered results for further analysis.
 
### Fine-tuning
 
A basic example of multi-GPUs supervised fine-tuning (SFT) with TRL and Accelerate modules is provided [here](https://huggingface.co/microsoft/Phi-4-mini-instruct/resolve/main/sample_finetune.py).
 
## Safety Evaluation and Red-Teaming
 
Various evaluation techniques including red teaming, adversarial conversation simulations, and multilingual safety evaluation benchmark datasets were leveraged to evaluate Phi-4 models’ propensity to produce undesirable outputs across multiple languages and risk categories. Several approaches were used to compensate for the limitations of one approach alone. Findings across the various evaluation methods indicate that safety post-training that was done as detailed in the Phi 3 Safety Post-Training paper had a positive impact across multiple languages and risk categories as observed by refusal rates (refusal to output undesirable outputs) and robustness to jailbreak techniques. Details on prior red team evaluations across Phi models can be found in the Phi 3 Safety Post-Training paper. For this release, the red team tested the model in English, Chinese, Japanese, Spanish, Portuguese, Arabic, Thai, and Russian for the following potential harms: Hate Speech and Bias, Violent Crimes, Specialized Advice, and Election Information. Their findings indicate that the model is resistant to jailbreak techniques across languages, but that language-specific attack prompts leveraging cultural context can cause the model to output harmful content. Another insight was that with function calling scenarios, the model could sometimes hallucinate function names or URL’s.  The model may also be more susceptible to longer multi-turn jailbreak techniques across both English and non-English languages. These findings highlight the need for industry-wide investment in the development of high-quality safety evaluation datasets across multiple languages, including low resource languages, and risk areas that account for cultural nuances where those languages are spoken.
 
## Software
* [PyTorch](https://github.com/pytorch/pytorch)
* [Transformers](https://github.com/huggingface/transformers)
* [Flash-Attention](https://github.com/HazyResearch/flash-attention)
 
## Hardware
Note that by default, the Phi-4-mini-instruct model uses flash attention, which requires certain types of GPU hardware to run. We have tested on the following GPU types:
* NVIDIA A100
* NVIDIA A6000
* NVIDIA H100
 
If you want to run the model on:
* NVIDIA V100 or earlier generation GPUs: call AutoModelForCausalLM.from_pretrained() with attn_implementation="eager"
 
## License
The model is licensed under the [MIT license](./LICENSE).
 
## Trademarks
This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party’s policies.
 
 
## Appendix A: Benchmark Methodology
 
We include a brief word on methodology here - and in particular, how we think about optimizing prompts.
In an ideal world, we would never change any prompts in our benchmarks to ensure it is always an apples-to-apples comparison when comparing different models. Indeed, this is our default approach, and is the case in the vast majority of models we have run to date.
There are, however, some exceptions to this. In some cases, we see a model that performs worse than expected on a given eval due to a failure to respect the output format. For example:
 
+ A model may refuse to answer questions (for no apparent reason), or in coding tasks models may prefix their response with “Sure, I can help with that. …” which may break the parser. In such cases, we have opted to try different system messages (e.g. “You must always respond to a question” or “Get to the point!”).
+ With some models, we observed that few shots actually hurt model performance. In this case we did allow running the benchmarks with 0-shots for all cases.
+ We have tools to convert between chat and completions APIs. When converting a chat prompt to a completion prompt, some models have different keywords e.g. Human vs User. In these cases, we do allow for model-specific mappings for chat to completion prompts.
 
However, we do not:
 
+ Pick different few-shot examples. Few shots will always be the same when comparing different models.
+ Change prompt format: e.g. if it is an A/B/C/D multiple choice, we do not tweak this to 1/2/3/4 multiple choice.
 
### Benchmark datasets
 
The model was evaluated across a breadth of public and internal benchmarks to understand the model’s capabilities under multiple tasks and conditions. While most evaluations use English, the leading multilingual benchmark was incorporated that covers performance in select languages.  More specifically,
 
+ Reasoning:
  + Winogrande: commonsense reasoning around pronoun resolution
  + PIQA: physical commonsense reasoning around everyday situations
  + ARC-challenge: grade-school multiple choice science questions
  + GPQA: very hard questions written and validated by experts in biology, physics, and chemistry
  + MedQA: medical questions answering
  + Social IQA: social commonsense intelligence
  + BoolQ: natural questions from context
  + TruthfulQA: grounded reasoning
+ Language understanding:
  + HellaSwag: commonsense natural language inference around everyday events
  + ANLI: adversarial natural language inference
+ Function calling:
  + Berkeley function calling function and tool call
  + Internal function calling benchmarks
+ World knowledge:
  + TriviaQA: trivia question on general topics
+ Math:
  + GSM8K: grade-school math word problems
  + GSM8K Hard: grade-school math word problems with large values and some absurdity.
  + MATH: challenging competition math problems
+ Code:
  + HumanEval HumanEval+, MBPP, MBPP+: python coding tasks
  + LiveCodeBenh, LiveBench: contamination-free code tasks
  + BigCode Bench: challenging programming tasks
  + Spider: SQL query tasks
  + Internal coding benchmarks
+ Instructions following:
  + IFEval: verifiable instructions
  + Internal instructions following benchmarks
+ Multilingual:
  + MGSM: multilingual grade-school math
  + Multilingual MMLU and MMLU-pro
  + MEGA: multilingual NLP tasks
+ Popular aggregated datasets: MMLU, MMLU-pro, BigBench-Hard, AGI Eval
+ Multi-turn conversations:
  + Data generated by in-house adversarial conversation simulation tool
+ Single-turn trustworthiness evaluation:
  + DecodingTrust: a collection of trustworthiness benchmarks in eight different perspectives
  + XSTest: exaggerated safety evaluation
  + Toxigen: adversarial and hate speech detection
+ Red Team:
  + Responses to prompts provided by AI Red Team at Microsoft
 
## Data Summary
https://huggingface.co/microsoft/Phi-4-mini-instruct/blob/main/data_summary_card.md