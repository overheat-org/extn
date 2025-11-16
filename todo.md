atualmente temos um problema:
estou colocando os managers dentro do input do rollup, isso é pessimo pq caso um manager importe o outro que também está no input, parte do conteudo sera processado e buildado duas vezes.

# Solução
Pensei em adicionar somente dois inputs, um para o index, e o outro para o manifest.

Assim, quando o manifest for chamado pelo hook `load`, retornamos o manifest já pronto com os imports e exports.

O problema é que teremos que fazer isso sem o auxílio do vite, teremos que analisar manualmente as importações usando babel, e com base nisso.

Scanner 
	|> Busca os managers e commands baseado na config
	|> Analisa os imports e cria uma estrutura

Há outro problema nisso que seria as importações de modulos do extn. Teriamos que achar o node_modules e analizar os commands e os managers dos modulos também.

# Conclusão

Primeiro, transformar managers em services. 

Scanner tem que receber a funcao de ler os arquivos um por um e extrair os arquivos que ele importa.

Isso inclui os pacotes que sejam modulos extn. O scanner tem que ler o diretório desses módulos e checar se existe um config file, se existir, será lido essa config para saber como aquele pacote quer que seja lido os comandos e managers.

Todos esses arquivos tem que ser registrados no graph, e adicionados no manifest com o pattern: "./managers/@org/name" ou "./managers/name"