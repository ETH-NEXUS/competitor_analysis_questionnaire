# ETHZ - NEXUS - Full Stack Template

This template should be used when starting up a new project with the default NEXUS stack.

Core tech:

- Python (Django)
- Vue (Nuxt + PrimeVue + Tailwind + npm)
- PostgreSQL
- Docker

## Setup Steps 🚀:

This process has two main parts. If you would like to **setup a new project** complete the tasks in both parts. On the other hand, if you would only like to **try out the project** and play around with different features skip to the second part.

### Setting up a New Project 🏗️

1. Copy the files into a new project repository.
2. Change instances of `fsex` to `your_project_name` in 6 files.
3. Rename `api/app/fsex` to `api/app/your_project_name`.
4. Delete the content of the following files in the `api/app/core` folder: `models` / `admin` / `serializers` / `endpoints` (leave only the default endpoint).
5. Delete everything in the `api/app/core/migrations` folder except the init file.
6. Remove the example ui components.

### Running This Project 🔧
You can either run it after you have made a copy for your own project or you can run it directly without changing anything.

1. Create an `.env` file in the main directory and copy the content of the `.env.TEMPLATE` in it.
2. Adjust the `.env` file values based on your needs and preferences. The values set in this file will be used for configuring different services of the project (e.g. Django settings, database settings and Quasar settings)
3. To make life easier install the [Docker Compose Command-Wrapper (DCC)](https://github.com/ETH-NEXUS/dcc) using `curl -Ls https://raw.githubusercontent.com/ETH-NEXUS/dcc/main/setup.sh | bash`. On mac you may have to add `~/.local/bin` to your `$PATH` env variable in your `.zshrc` or `.bashrc`.
5. Run `dcc up` to start the project and create containers.
6. In a separate terminal navigate to the root project directory and run `dcc sh api` to get into the api container. Then run `python manage.py makemigrations` to create migration files and `python manage.py migrate` to apply the changes.
7. Visit `localhost:8077/admin` and login using the user and password defined in the `.env` file. It can happen that the changes are not immediatelly accepted and you have to shut down your containers and run them again for the admin user to be accepted.
8.  Adjust the `readme.md` at the root of the project to describe your project and provide relevant information for it.

Congratulations you're done!

### How do I make my admin panel look fancy?
Install [django-unfold](https://github.com/unfoldadmin/django-unfold).

### How do I make vscode detect my installed python packages?
   1. Create python environment: `python -m venv pythonenv` (make sure to name it pythonenv as it is also added to `.gitignore`)
   2. Activate python environment: `source pythonenv/bin/activate`
   3. Install packages in python environment: `pipenv install -r ./api/requirements.dev.txt`
   4. Use python environment in your editor: Open the command palette and run the command `Python: Select Interpreter` and select `pythonenv`.


## URLs

- `localhost:8077` = Application UI
- `localhost:8077/admin` = Admin panel
- `localhost:8077/swagger` = API UI with option to execute API calls directly

### How to deploy?
TODO: Add deploy instructions.