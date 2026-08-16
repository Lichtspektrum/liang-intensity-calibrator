---
pipeline_tag: text-generation
inference: false
license: apache-2.0
library_name: transformers
tags:
- language
- granite-3.1
base_model:
- ibm-granite/granite-3.1-3b-a800m-base
---

# Granite-3.1-3B-A800M-Instruct

**Model Summary:**
Granite-3.1-3B-A800M-Instruct is a 3B parameter long-context instruct model finetuned from Granite-3.1-3B-A800M-Base using a combination of open source instruction datasets with permissive license and internally collected synthetic datasets tailored for solving long context problems. This model is developed using a diverse set of techniques with a structured chat format, including supervised finetuning, model alignment using reinforcement learning, and model merging.

- **Developers:** Granite Team, IBM
- **GitHub Repository:** [ibm-granite/granite-3.1-language-models](https://github.com/ibm-granite/granite-3.1-language-models)
- **Website**: [Granite Docs](https://www.ibm.com/granite/docs/)
- **Paper:** [Granite 3.1 Language Models (coming soon)](https://huggingface.co/collections/ibm-granite/granite-31-language-models-6751dbbf2f3389bec5c6f02d) 
- **Release Date**: December 18th, 2024
- **License:** [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)

**Supported Languages:** 
English, German, Spanish, French, Japanese, Portuguese, Arabic, Czech, Italian, Korean, Dutch, and Chinese. Users may finetune Granite 3.1 models for languages beyond these 12 languages.

**Intended Use:** 
The model is designed to respond to general instructions and can be used to build AI assistants for multiple domains, including business applications.

*Capabilities*
* Summarization
* Text classification
* Text extraction
* Question-answering
* Retrieval Augmented Generation (RAG)
* Code related tasks
* Function-calling tasks
* Multilingual dialog use cases
* Long-context tasks including long document/meeting summarization, long document QA, etc.

**Generation:** 
This is a simple example of how to use Granite-3.1-3B-A800M-Instruct model.

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

device = "auto"
model_path = "ibm-granite/granite-3.1-3b-a800m-Instruct"
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
print(output)
```
**Evaluation Results:**
<table>
  <caption><b>HuggingFace Open LLM Leaderboard V1</b></caption>
<thead>
  <tr>
    <th style="text-align:left; background-color: #001d6c; color: white;">Models</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">ARC-Challenge</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">Hellaswag</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">MMLU</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">TruthfulQA</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">Winogrande</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">GSM8K</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">Avg</th>
  </tr></thead>
  <tbody>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Granite-3.1-8B-Instruct</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">62.62</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">84.48</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">65.34</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">66.23</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">75.37</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">73.84</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">71.31</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">Granite-3.1-2B-Instruct</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">54.61</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">75.14</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">55.31</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">59.42</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">67.48</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">52.76</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">60.79</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #DAE8FF; color: #2D2D2D;">Granite-3.1-3B-A800M-Instruct</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">50.42</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">73.01</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">52.19</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">49.71</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">64.87</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">48.97</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">56.53</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">Granite-3.1-1B-A400M-Instruct</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">42.66</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">65.97</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">26.13</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">46.77</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">62.35</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">33.88</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">46.29</td>
  </tr>
</tbody></table>

<table>
  <caption><b>HuggingFace Open LLM Leaderboard V2</b></caption>
<thead>
  <tr>
    <th style="text-align:left; background-color: #001d6c; color: white;">Models</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">IFEval</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">BBH</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">MATH Lvl 5</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">GPQA</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">MUSR</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">MMLU-Pro</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">Avg</th>
  </tr></thead>
  <tbody>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Granite-3.1-8B-Instruct</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">72.08</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">34.09</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">21.68</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8.28</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">19.01</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">28.19</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">30.55</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">Granite-3.1-2B-Instruct</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">62.86</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">21.82</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">11.33</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">5.26</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">4.87</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">20.21</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">21.06</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #DAE8FF; color: #2D2D2D;">Granite-3.1-3B-A800M-Instruct</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">55.16</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">16.69</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">10.35</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">5.15</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">2.51</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">12.75</td>
    <td style="text-align:center; background-color: #DAE8FF; color: #2D2D2D;">17.1</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: #2D2D2D;">Granite-3.1-1B-A400M-Instruct</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">46.86</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">6.18</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">4.08</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">0</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">0.78</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">2.41</td>
    <td style="text-align:center; background-color: #FFFFFF; color: #2D2D2D;">10.05</td>
  </tr>
</tbody></table>

**Model Architecture:**
Granite-3.1-3B-A800M-Instruct is based on a decoder-only dense transformer architecture. Core components of this architecture are: GQA and RoPE, MLP with SwiGLU, RMSNorm, and shared input/output embeddings.
<table>
<thead>
  <tr>
    <th style="text-align:left; background-color: #001d6c; color: white;">Model</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">2B Dense</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">8B Dense</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">1B MoE</th>
    <th style="text-align:center; background-color: #001d6c; color: white;">3B MoE</th>
  </tr></thead>
<tbody>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Embedding size</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">2048</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">4096</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">1024</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">1536</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of layers</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">40</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">40</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">24</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">32</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Attention head size</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">64</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">128</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">64</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">64</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of attention heads</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">32</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">32</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">16</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">24</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of KV heads</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">8</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">MLP hidden size</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8192</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">12800</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">512</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">512</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">MLP activation</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">SwiGLU</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">SwiGLU</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">SwiGLU</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">SwiGLU</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Number of experts</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">—</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">—</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">32</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">40</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">MoE TopK</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">—</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">—</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">8</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Initialization std</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">0.1</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">0.1</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">0.1</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">0.1</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Sequence length</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">128K</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">128K</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">128K</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">128K</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;">Position embedding</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">RoPE</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">RoPE</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">RoPE</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">RoPE</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;"># Parameters</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">2.5B</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8.1B</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">1.3B</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">3.3B</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;"># Active parameters</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">2.5B</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">8.1B</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">400M</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">800M</td>
  </tr>
  <tr>
    <td style="text-align:left; background-color: #FFFFFF; color: black;"># Training tokens</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">12T</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">12T</td>
    <td style="text-align:center; background-color: #FFFFFF; color: black;">10T</td>
    <td style="text-align:center; background-color: #DAE8FF; color: black;">10T</td>
  </tr>
</tbody></table>

**Training Data:** 
Overall, our SFT data is largely comprised of three key sources: (1) publicly available datasets with permissive license, (2) internal synthetic data targeting specific capabilities including long-context tasks, and (3) very small amounts of human-curated data. A detailed attribution of datasets can be found in the [Granite 3.0 Technical Report](https://github.com/ibm-granite/granite-3.0-language-models/blob/main/paper.pdf), [Granite 3.1 Technical Report (coming soon)](https://huggingface.co/collections/ibm-granite/granite-31-language-models-6751dbbf2f3389bec5c6f02d), and [Accompanying Author List](https://github.com/ibm-granite/granite-3.0-language-models/blob/main/author-ack.pdf).

**Infrastructure:**
We train Granite 3.1 Language Models using IBM's super computing cluster, Blue Vela, which is outfitted with NVIDIA H100 GPUs. This cluster provides a scalable and efficient infrastructure for training our models over thousands of GPUs.

**Ethical Considerations and Limitations:** 
Granite 3.1 Instruct Models are primarily finetuned using instruction-response pairs mostly in English, but also multilingual data covering eleven languages. Although this model can handle multilingual dialog use cases, its performance might not be similar to English tasks. In such case, introducing a small number of examples (few-shot) can help the model in generating more accurate outputs. While this model has been aligned by keeping safety in consideration, the model may in some cases produce inaccurate, biased, or unsafe responses to user prompts. So we urge the community to use this model with proper safety testing and tuning tailored for their specific tasks.

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