<div class="panel panel-default">
	<div class="panel-heading">Регистрация</div>
    <div class="panel-body">
 
	<form method="post"  action="<?php echo KELLY_ROOT_URL; ?>login/do-register">
		<!--<legend>Загузить данные по товарам вручную</legend>-->
		  <input type="hidden" name="formName" value="user_reg">
          <input type="hidden" name="token_data" value="<?php echo Token::set('user_reg'); ?>">
		  <div class="form-group">
			<label for="user-add-login">Логин</label>
			<input name="login" class="form-control" id="user-add-login" placeholder="Логин">
		  </div>
          
		  <div class="form-group">
			<label for="user-add-password">Пароль</label>
			<input type="password" name="password" class="form-control" id="user-add-password" placeholder="Пароль">
		  </div>
		  
		<button type="submit" class="btn btn-default">Создать</button>
		<?php if (!empty($vars['result'])) { ?>
            <p>
             <?php echo $vars['result']; ?>
            </p>
		<?php } ?>
	</form>
  </div>
</div>
