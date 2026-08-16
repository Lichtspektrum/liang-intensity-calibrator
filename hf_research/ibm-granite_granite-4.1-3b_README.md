---
license: apache-2.0
library_name: transformers
tags:
- language
- granite-4.1
---

[![mof-class3-qualified](https://mot.isitopen.ai/modules/mof/assets/badge_class3_qualified.png)](https://mot.isitopen.ai/model/1160)

# Granite-4.1-3B

<!-- 📣 **Update [10-07-2025]:** Added a *default system prompt* to the chat template to guide the model towards more *professional, accurate, and safe* responses. -->

**Model Summary:**
Granite-4.1-3B is a 3B parameter long-context instruct model finetuned from *Granite-4.1-3B-Base* using a combination of open source instruction datasets with permissive license and internally collected synthetic datasets. Granite 4.1 models have gone through an improved post-training pipeline, including supervised finetuning and reinforcement learning alignment, resulting in enhanced tool calling, instruction following, and chat capabilities.

- **Developers:** Granite Team, IBM
- **HF Collection:** [Granite 4.1 Language Models HF Collection](https://huggingface.co/collections/ibm-granite/granite-41-language-models)
- **Technical Blog:** [Granite-4.1 Blog](https://huggingface.co/blog/ibm-granite/granite-4-1)
- **GitHub Repository:** [ibm-granite/granite-4.1-language-models](https://github.com/ibm-granite/granite-4.1-language-models)
- **Website**: [Granite Docs](https://www.ibm.com/granite/docs/) 
- **Release Date**: April 29th, 2026
- **License:** [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)

**Supported Languages:** 
English, German, Spanish, French, Japanese, Portuguese, Arabic, Czech, Italian, Korean, Dutch, and Chinese. Users may finetune Granite 4.1 models for languages beyond these languages.

**Intended use:** 
The model is designed to follow general instructions and can serve as the foundation for AI assistants across diverse domains, including business applications, as well as for LLM agents equipped with tool-use capabilities.

*Capabilities*
* Summarization
* Text classification
* Text extraction
* Question-answering
* Retrieval Augmented Generation (RAG)
* Code related tasks
* Function-calling tasks
* Multilingual dialog use cases
* Fill-In-the-Middle (FIM) code completions

<!-- <todo>Need to test the examples. (especially the tool calling and RAG ones)</todo>
 -->
 
**Generation:** 
This is a simple example of how to use Granite-4.1-3B model.

Install the following libraries:

```shell
pip install torch torchvision torchaudio
pip install accelerate
pip install transformers
```
Then, copy the snippet from the section that is relevant for your use case.

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

device = "cuda"
model_path = "ibm-granite/granite-4.1-3b"
tokenizer = AutoTokenizer.from_pretrained(model_path)
# drop device_map if running on CPU
model = AutoModelForCausalLM.from_pretrained(model_path, device_map=device)
model.eval()
# change input text as desired
chat = [
    { "role": "user", "content": "Please list one IBM Research laboratory located in the United States. You should only output its name and location." },
]
chat = tokenizer.apply_chat_template(chat, tokenize=False, add_generation_prompt=True)
# tokenize the text
input_tokens = tokenizer(chat, return_tensors="pt").to(device)
# generate output tokens
output = model.generate(**input_tokens, 
                        max_new_tokens=100)
# decode output tokens into text
output = tokenizer.batch_decode(output)
# print output
print(output[0])
```

Expected output:
```shell
<|start_of_role|>user<|end_of_role|>Please list one IBM Research laboratory located in the United States. You should only output its name and location.<|end_of_text|>
<|start_of_role|>assistant<|end_of_role|>Almaden Research Center, San Jose, California<|end_of_text|>
```
<!-- 📣 **Update [2025-10-07]:** Added a *default system prompt* to the chat template to guide the model towards more *professional, accurate, and safe* responses. -->

**Tool-calling:** 
Granite-4.1-3B comes with enhanced tool calling capabilities, enabling seamless integration with external functions and APIs. To define a list of  tools please follow OpenAI's function [definition schema](https://platform.openai.com/docs/guides/function-calling?api-mode=responses#defining-functions). 

This is an example of how to use Granite-4.1-3B model tool-calling ability:

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

device = "cuda"
model_path = "ibm-granite/granite-4.1-3b"
tokenizer = AutoTokenizer.from_pretrained(model_path)
# drop device_map if running on CPU
model = AutoModelForCausalLM.from_pretrained(model_path, device_map=device)
model.eval()

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather for a specified city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "Name of the city"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# change input text as desired
chat = [
    { "role": "user", "content": "What's the weather like in Boston right now?" },
]
chat = tokenizer.apply_chat_template(chat, \
                                     tokenize=False, \
                                     tools=tools, \
                                     add_generation_prompt=True)
# tokenize the text
input_tokens = tokenizer(chat, return_tensors="pt").to(device)
# generate output tokens
output = model.generate(**input_tokens, 
                        max_new_tokens=100)
# decode output tokens into text
output = tokenizer.batch_decode(output)
# print output
print(output[0])
```

Expected output:
```shell
<|start_of_role|>system<|end_of_role|>You are a helpful assistant with access to the following tools. You may call one or more tools to assist with the user query.

You are provided with function signatures within <tools></tools> XML tags:
<tools>
{"type": "function", "function": {"name": "get_current_weather", "description": "Get the current weather for a specified city.", "parameters": {"type": "object", "properties": {"city": {"type": "string", "description": "Name of the city"}}, "required": ["city"]}}}
</tools>

For each tool call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:
<tool_call>
{"name": <function-name>, "arguments": <args-json-object>}
</tool_call>. If a tool does not exist in the provided list of tools, notify the user that you do not have the ability to fulfill the request.<|end_of_text|>
<|start_of_role|>user<|end_of_role|>What's the weather like in Boston right now?<|end_of_text|>
<|start_of_role|>assistant<|end_of_role|><tool_call>
{"name": "get_current_weather", "arguments": {"city": "Boston"}}
</tool_call><|end_of_text|>
```

<!-- **Retrieval Augmented Generation:** 
*Coming soon* -->

**Evaluation Results:** 

<table>
<!--   <caption><b> All Results</b></caption> -->
<thead>
  <tr>
    <th style="text-align:left; background-color: #001d6c; color: white;">Benchmarks</th>
    <th style="text-align:left; background-color: #001d6c; color: white;">Metric</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">3B Dense</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">8B Dense</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">30B Dense</th>
  </tr>
</thead>
  <tbody>
<tr>
  <td colspan="5" style="text-align:center; background-color:  #FFFFFF; color: #2D2D2D; font-style:italic;">
    General Tasks
  </td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MMLU</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">5-shot</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">67.02</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">73.84</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">80.16</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MMLU-Pro</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">5-shot, CoT</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">49.83</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">55.99</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">64.09</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">BBH</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">3-shot, CoT</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">75.83</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">80.51</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">83.74</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">AGI EVAL</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">0-shot, CoT</td>
    <td style="text-align:right; background-color:#DAE8FF; color: #2D2D2D;">65.16</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">72.43</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">77.80</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">GPQA</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">0-shot, CoT</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">31.70</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">41.96</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">45.76</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">SimpleQA</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">3.68</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">4.82</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">6.81</td>
</tr>
<tr>
  <td colspan="5" style="text-align:center; background-color:  #FFFFFF; color: #2D2D2D; font-style:italic;">
    Alignment Tasks
  </td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">AlpacaEval 2.0</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">38.57</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">50.08</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">56.16</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">IFEval Avg</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">82.30</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">87.06</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">89.65</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">ArenaHard</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">37.80</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">68.98</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">71.02</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MTBench Avg</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">7.57</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">8.61</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">8.61</td>
</tr>
<tr>
  <td colspan="5" style="text-align:center; background-color:  #FFFFFF; color: #2D2D2D; font-style:italic;">
    Math Tasks
  </td>
</tr>      
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">GSM8K</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">8-shot</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">86.88</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">92.49</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">94.16</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">GSM Symbolic</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">8-shot</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">81.32</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">83.70</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">75.70</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">Minerva Math</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">0-shot, CoT</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">67.94</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">80.10</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">81.32</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">DeepMind Math</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">0-shot, CoT</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">64.64</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">80.07</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">81.93</td>
</tr>
<tr>
  <td colspan="5" style="text-align:center; background-color:  #FFFFFF; color: #2D2D2D; font-style:italic;">
    Code Tasks
  </td>
</tr> 
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">HumanEval</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">81.71</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">85.37</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">88.41</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">HumanEval+</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">76.83</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">79.88</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">85.37</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MBPP</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">71.16</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">87.30</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">85.45</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MBPP+</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">62.17</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">73.81</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">73.54</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">CRUXEval-O</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">40.75</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">47.63</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">55.75</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">BigCodeBench</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">32.19</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">35.00</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">38.77</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MULTIPLE</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">52.54</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">60.26</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">62.31</td>
</tr>
<tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">Eval+ Avg</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">pass@1</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">67.05</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">80.21</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">82.66</td>
</tr>
<tr>
  <td colspan="5" style="text-align:center; background-color:  #FFFFFF; color: #2D2D2D; font-style:italic;">
    Tool Calling Tasks
  </td>
</tr> 
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">BFCL v3</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">60.80</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">68.27</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">73.68</td>
</tr>
<tr>
  <td colspan="5" style="text-align:center; background-color:  #FFFFFF; color: #2D2D2D; font-style:italic;">
    Multilingual Tasks
  </td>
</tr> 
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MMMLU</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">5-shot</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">57.61</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">64.84</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">73.71</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">INCLUDE</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">5-shot</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">52.05</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">58.89</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">67.26</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MGSM</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">8-shot</td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">70.00</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">82.32</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">71.12</td>
</tr>
<tr>
  <td colspan="6" style="text-align:center; background-color:  #FFFFFF; color: #2D2D2D; font-style:italic;">
    Safety
  </td>
</tr> 
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">SALAD-Bench</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">93.95</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">95.80</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">96.41</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">AttaQ</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">81.88</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">81.19</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">85.76</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">Tulu3 Safety Eval Avg</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;"></td>
    <td style="text-align:right; background-color: #DAE8FF; color: #2D2D2D;">66.84</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">75.57</td>
    <td style="text-align:right; background-color: #FFFFFF; color: #2D2D2D;">78.19</td>
</tr>
</tbody></table>


<table>
  <caption><b>Multilingual Benchmarks and the included languages:</b></caption>
<thead>
  <tr>
    <th style="text-align:left; background-color: #001d6c; color: white;">Benchmarks</th>
    <th style="text-align:left; background-color: #001d6c; color: white;"># Langs</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">Languages</th>
  </tr>
</thead>
<tbody>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MMMLU</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">11</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">ar, de, en, es, fr, ja, ko, pt, zh, bn, hi</td>
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">INCLUDE</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">14</td>
<!--     <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">hindi, bengali, tamil, telugu, arabic, german, spanish, french, italian, japanese, korean, dutch, portuguese, chinese</td> -->
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">hi, bn, ta, te, ar, de, es, fr, it, ja, ko, nl, pt, zh</td>
    
</tr>
<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">MGSM</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">5</td>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">en, es, fr, ja, zh</td>
</tr>
</tbody>
</table>

**Model Architecture:** 

Granite-4.1-3B baseline is built on a decoder-only dense transformer architecture. Core components of this architecture are: GQA, RoPE, MLP with SwiGLU, RMSNorm, and shared input/output embeddings.

<table>
<thead>
  <tr>
    <th style="text-align:left; background-color: #001d6c; color: white;">Model</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">3B Dense</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">8B Dense</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">30B Dense</th>
  </tr></thead>
<tbody>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Embedding size</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">2560</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">4096</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">4096</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of layers</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">40</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">40</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">64</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Attention head size</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">64</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">128</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">128</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of attention heads</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">40</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">32</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">32</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of KV heads</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">8</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8</td>
  </tr>
  <!--<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Mamba2 state size</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">-</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;"></td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
  </tr> 
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of Mamba2 heads</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;"></td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
  </tr>-->

  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">MLP / Shared expert hidden size</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">8192</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">12800</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">32768</td>
  </tr>
  <!--<tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Num. Experts</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;"></td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Num. active Experts</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;"></td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Expert hidden size</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;"></td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
  </tr>-->

  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">MLP activation</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">SwiGLU</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">SwiGLU</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">SwiGLU</td>
  </tr>

  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Sequence length</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">131072</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">131072</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">131072</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Position embedding</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">RoPE</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">RoPE</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">RoPE</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;"># Parameters</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">3B</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8B</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">30B</td>
  </tr>
<!--  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;"># Active parameters</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;"></td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;"></td>
  </tr>-->
</tbody></table>



**Training Data:** 
Overall, our SFT data is largely comprised of three key sources: (1) publicly available datasets with permissive license, (2) internal synthetic data targeting specific capabilities, and (3) a select set of human-curated data.

**Supervised Fine-Tuning and Reinforcement Learning:** 
Instruct model has been fine tuned with significantly improved SFT-pipeline and Reinforcement learning pipelines with high quality mix of various datasets as mentioned above. With rigorous SFT-RL cycles we have improved Granite-4.1 model's tool calling, instruction following and chat capabilities. For further details please check our [Granite-4.1 Blog](https://huggingface.co/blog/ibm-granite/granite-4-1). 

**Infrastructure:**
We trained the Granite 4.1 Language Models utilizing an NVIDIA GB200 NVL72 cluster hosted in CoreWeave. Intra-rack communication occurs via the 72-GPU NVLink domain, and a non-blocking, full Fat-Tree NDR 400 Gb/s InfiniBand network provides inter-rack communication. This cluster provides a scalable and efficient infrastructure for training our models over thousands of GPUs.

**Ethical Considerations and Limitations:** 
Granite 4.1 Instruction Models are primarily finetuned using instruction-response pairs mostly in English, but also multilingual data covering multiple languages. Although this model can handle multilingual dialog use cases, its performance might not be similar to English tasks. In such cases, introducing a small number of examples (few-shot) can help the model in generating more accurate outputs. While this model has been aligned by keeping safety in consideration, the model may in some cases produce inaccurate, biased, or unsafe responses to user prompts. We urge the community to use this model with proper safety testing and tuning tailored for their specific tasks.   To enhance safety in enterprise deployments, we recommend using Granite 4.1 Language models alongside [Granite Guardian](https://huggingface.co/ibm-granite/granite-guardian-4.1-8b), a model designed to detect and flag risks in inputs and outputs across key dimensions outlined in the IBM AI Risk Atlas.  

**Resources**
- ⭐️ Learn about the latest updates with Granite: https://www.ibm.com/granite
- 📄 Get started with tutorials, best practices, and prompt engineering advice: https://www.ibm.com/granite/docs/
- 💡 Learn about the latest Granite learning resources: https://ibm.biz/granite-learning-resources

<!-- ## Citation
```
@misc{granite-models,
  author = {author 1, author2, ...},
  title = {},
  journal = {},
  volume = {},
  year = {2024},
  url = {https://arxiv.org/abs/0000.00000},
}
``` -->